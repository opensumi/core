import { IRPCProtocol } from '@opensumi/ide-connection';
import { getDebugLogger } from '@opensumi/ide-core-common';

import {
  IInterProcessConnectionService,
  IInterProcessConnection,
  ExtensionConnection,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';

export class ExtHostConnection implements IInterProcessConnectionService {
  private proxy: IInterProcessConnection;
  private connections = new Map<string, ExtensionConnection>();

  private readonly debug = getDebugLogger();

  constructor(private rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadConnection);
  }

  /**
   * 通过ID获取Connection并发送消息
   * @param id
   * @param message
   */
  async $sendMessage(id: string, message: string): Promise<void> {
    if (this.connections.has(id)) {
      this.connections.get(id)?.readMessage(message);
    }
  }

  /**
   * 创建Connection
   * @param id
   */
  async $createConnection(id: string): Promise<void> {
    await this.doEnsureConnection(id);
  }

  /**
   * 移除Connection
   * @param id
   */
  async $deleteConnection(id: string): Promise<void> {
    this.connections.delete(id);
  }

  /**
   * 如果已存在，返回存在的Connection，否则创建新的Connection
   * @param id
   */
  async ensureConnection(id: string): Promise<ExtensionConnection> {
    const connection = await this.doEnsureConnection(id);
    this.proxy.$createConnection(id);
    return connection;
  }

  /**
   * 如果已存在，返回存在的Connection，否则创建新的Connection
   * @param id
   */
  async doEnsureConnection(id: string): Promise<ExtensionConnection> {
    const connection = this.connections.get(id) || (await this.doCreateConnection(id));
    this.connections.set(id, connection);
    return connection;
  }

  /**
   * 创建新的Connection
   * @param id
   */
  protected async doCreateConnection(id: string): Promise<ExtensionConnection> {
    return new ExtensionConnection(id, this.proxy, () => {
      this.connections.delete(id);
      this.proxy.$deleteConnection(id);
    });
  }
}
