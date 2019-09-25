import * as net from 'net';
import { Injectable, Autowired } from '@ali/common-di';
import {
  IProcessFactory,
  IProcessManage,
  IProcess,
  ForkOptions,
  ProcessOptions,
} from '@ali/ide-process';
import {
  DebugAdapterExecutable,
  DebugStreamConnection,
  DebugAdapterSession,
  DebugAdapterSessionFactory,
  DebugAdapterFactory,
} from '../common/debug-model';
import { DebugAdapterSessionImpl } from './debug-adapter-session';

/**
 * 通过子进程运行Debug Adapter
 */
@Injectable()
export class LaunchBasedDebugAdapterFactory implements DebugAdapterFactory {
  @Autowired(IProcessFactory)
  protected readonly processFactory: IProcessFactory;
  @Autowired(IProcessManage)
  protected readonly processManager: IProcessManage;

  start(executable: DebugAdapterExecutable): DebugStreamConnection {
    const process = this.childProcess(executable);
    return {
      input: process.inputStream,
      output: process.outputStream,
      dispose: () => process.dispose(),
    };
  }

  private childProcess(executable: DebugAdapterExecutable): IProcess {
    const isForkOptions = (forkOptions: ForkOptions | any): forkOptions is ForkOptions =>
      !!forkOptions && !!forkOptions.modulePath;

    const processOptions: ProcessOptions | ForkOptions = { ...executable };
    const options = { stdio: ['pipe', 'pipe', 2] };

    if (isForkOptions(processOptions)) {
      options.stdio.push('ipc');
    }

    processOptions.options = options;
    return this.processFactory.create(processOptions);
  }

  connect(debugServerPort: number): DebugStreamConnection {
    const socket = net.createConnection(debugServerPort);
    return {
      input: socket,
      output: socket,
      dispose: () => socket.end(),
    };
  }
}

@Injectable()
export class DebugAdapterSessionFactoryImpl implements DebugAdapterSessionFactory {

  get(sessionId: string, debugStreamConnection: DebugStreamConnection): DebugAdapterSession {
    return new DebugAdapterSessionImpl(
      sessionId,
      debugStreamConnection,
    );
  }
}
