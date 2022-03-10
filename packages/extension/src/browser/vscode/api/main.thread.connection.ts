import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { ILoggerManagerClient, ILogServiceClient, SupportLogNamespace, Deferred } from '@opensumi/ide-core-browser';
import { Disposable, DisposableCollection } from '@opensumi/ide-core-common';

import {
  IMainThreadConnectionService,
  ExtensionConnection,
  IExtHostConnection,
  ExtHostAPIIdentifier,
  ExtensionMessageReader,
  ExtensionMessageWriter,
} from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadConnection implements IMainThreadConnectionService {
  private proxy: IExtHostConnection;
  private connections = new Map<string, ExtensionConnection>();
  private connectionsReady = new Map<string, Deferred<void>>();
  private readonly toDispose = new DisposableCollection();

  @Autowired(ILoggerManagerClient)
  protected readonly LoggerManager: ILoggerManagerClient;
  protected readonly logger: ILogServiceClient;

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostConnection);
    this.logger = this.LoggerManager.getLogger(SupportLogNamespace.ExtensionHost);
  }

  dispose() {
    this.connections.forEach((connection) => {
      connection.dispose();
    });

    this.connections.clear();

    this.toDispose.dispose();
  }
  /**
   * 通过ID获取Connection并发送对应消息
   * @param id
   * @param message
   */
  async $sendMessage(id: string, message: string): Promise<void> {
    const ready = this.connectionsReady.get(id);
    if (ready) {
      await ready.promise;
    }
    if (this.connections.has(id)) {
      this.connections.get(id)!.reader.readMessage(message);
    } else {
      this.logger.warn(`Do not found connection ${id}`);
    }
  }

  /**
   * 创建新的Connection
   * 当链接ID存在时，返回已有Connection
   * @param id
   */
  async $createConnection(id: string): Promise<void> {
    this.logger.log(`create connection ${id}`);
    await this.doEnsureConnection(id);
  }
  /**
   * 根据ID删除Connection
   * @param id
   */
  async $deleteConnection(id: string): Promise<void> {
    this.logger.log(`delete connection ${id}`);
    this.connections.delete(id);
  }

  /**
   * 返回已存在的Connection或创建新的Connection
   * @param id
   */
  async ensureConnection(id: string): Promise<ExtensionConnection> {
    const connection = await this.doEnsureConnection(id);
    await this.proxy.$createConnection(id);
    return connection;
  }

  /**
   * 执行获取/新建Connection操作
   * @param id
   */
  async doEnsureConnection(id: string): Promise<ExtensionConnection> {
    let connection = this.connections.get(id);
    if (!connection) {
      const ready = new Deferred<void>();
      this.connectionsReady.set(id, ready);
      connection = await this.doCreateConnection(id);
      ready.resolve();
      this.connections.set(id, connection);
      this.connectionsReady.delete(id);
    }

    return connection;
  }

  protected async doCreateConnection(id: string): Promise<ExtensionConnection> {
    const reader = new ExtensionMessageReader();
    const writer = new ExtensionMessageWriter(id, this.proxy);
    const connection = new ExtensionConnection(reader, writer, () => {
      this.connections.delete(id);
      this.proxy.$deleteConnection(id);
    });

    const toClose = new DisposableCollection(Disposable.create(() => reader.fireClose()));
    this.toDispose.push(toClose);

    return connection;
  }
}
