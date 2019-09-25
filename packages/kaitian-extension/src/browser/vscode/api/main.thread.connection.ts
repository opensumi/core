import { IMainThreadConnectionService, ExtensionConnection, IExtHostConnection, ExtHostAPIIdentifier, ExtensionMessageReader, ExtensionMessageWriter } from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol, WSChanneHandler } from '@ali/ide-connection';
import { DisposableCollection, Uri, ILoggerManagerClient, ILogServiceClient, SupportLogNamespace } from '@ali/ide-core-browser';

@Injectable()
export class MainThreadConnection implements IMainThreadConnectionService {
  private proxy: IExtHostConnection;
  private connections = new Map<string, ExtensionConnection>();

  @Autowired(ILoggerManagerClient)
  protected readonly LoggerManager: ILoggerManagerClient;
  protected readonly logger: ILogServiceClient = this.LoggerManager.getLogger(SupportLogNamespace.ExtensionHost);

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostConnection);
  }

  /**
   * 通过ID获取Connection并发送对应消息
   * @param id
   * @param message
   */
  async $sendMessage(id: string, message: string): Promise<void> {
    if (this.connections.has(id)) {
      this.connections.get(id)!.reader.readMessage(message);
    } else {
      this.logger.warn(`找不到对应链接 ${id}`);
    }
  }

  /**
   * 创建新的Connection
   * 当链接ID存在时，返回已有Connection
   * @param id
   */
  async $createConnection(id: string): Promise<void> {
    await this.doEnsureConnection(id);
  }
  /**
   * 根据ID删除Connection
   * @param id
   */
  async $deleteConnection(id: string): Promise<void> {
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
    const connection = this.connections.get(id) || await this.doCreateConnection(id);
    this.connections.set(id, connection);
    return connection;
  }

  protected async doCreateConnection(id: string): Promise<ExtensionConnection> {
    const reader = new ExtensionMessageReader();
    const writer = new ExtensionMessageWriter(id, this.proxy);
    return new ExtensionConnection(
      reader,
      writer,
      () => {
        this.connections.delete(id);
        this.proxy.$deleteConnection(id);
      });
  }
}
