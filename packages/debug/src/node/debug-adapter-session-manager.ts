import { UUID } from '@phosphor/coreutils';
import { Injectable, Autowired } from '@ali/common-di';
import {
  commonChannelPathHandler,
  createWebSocketConnection,
} from '@ali/ide-connection';

import { DebugAdapterPath } from '../common/debug-service';
import { DebugConfiguration } from '../common/debug-configuration';
import { DebugAdapterSession, DebugAdapterSessionFactory, DebugAdapterFactory } from '../common/debug-model';
import { DebugAdapterContributionRegistry } from './debug-adapter-contribution-registry';
import { RPCServiceCenter } from '@ali/ide-core-node';

@Injectable()
export class DebugAdapterSessionManager {
  protected readonly sessions = new Map<string, DebugAdapterSession>();

  @Autowired(DebugAdapterSessionFactory)
  protected readonly debugAdapterSessionFactory: DebugAdapterSessionFactory;

  @Autowired(DebugAdapterFactory)
  protected readonly debugAdapterFactory: DebugAdapterFactory;

  /**
   * 创建新的DebugAdapterSession
   * @param config
   * @param registry
   */
  async create(config: DebugConfiguration, registry: DebugAdapterContributionRegistry): Promise<DebugAdapterSession> {
    const sessionId = UUID.uuid4();

    let communicationProvider;
    if ('debugServer' in config) {
      communicationProvider = this.debugAdapterFactory.connect(config.debugServer);
    } else {
      const executable = await registry.provideDebugAdapterExecutable(config);
      communicationProvider = this.debugAdapterFactory.start(executable);
    }
    const serviceCenter = new RPCServiceCenter();
    const sessionFactory = registry.debugAdapterSessionFactory(config.type) || this.debugAdapterSessionFactory;
    const session = sessionFactory.get(sessionId, communicationProvider);
    this.sessions.set(sessionId, session);

    commonChannelPathHandler.register(`${DebugAdapterPath}/${sessionId}`, {
      handler: (connection) => {
        console.log('Node side connected!');
        const serverConnection = createWebSocketConnection(connection);
        connection.messageConnection = serverConnection;
        serviceCenter.setConnection(serverConnection);
        session.start(serverConnection);
      },
      dispose: (connection?: any) => {
        if (connection) {
          serviceCenter.removeConnection(connection.messageConnection);
          session.stop();
        }
      },
    });

    return session;
  }

  /**
   * 从实例化后的调试适配器进程列表中移除指定session
   * @param sessionId
   */
  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * 通过sessionId查询调试适配器进程
   * @param sessionId
   */
  find(sessionId: string): DebugAdapterSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有实例化的调试适配器进程
   */
  getAll(): IterableIterator<DebugAdapterSession> {
    return this.sessions.values();
  }
}
