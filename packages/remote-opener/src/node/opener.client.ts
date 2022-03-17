import { Injectable, Autowired } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { IExternalFileArgs, IExternalUrlArgs, IRemoteOpenerClient, IRemoteOpenerService } from '../common';

// remote opener 强制打开的ClientId的数量限制，在限制之内的话会遍历Map，无视ClientId对应强制打开
// 原因是：避免Terminal Restore这种场景下，环境变量的ClientID和窗口的不一致，导致无法使用RemoteOpen，做一个兜底
const FORCE_OPEN_LIMIT = 4;
@Injectable()
export class RemoteOpenerClientImpl implements IRemoteOpenerClient {
  private remoteOpenerServices: Map<string, IRemoteOpenerService> = new Map();

  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  setRemoteOpenerServiceInstance(clientId: string, service: IRemoteOpenerService): void {
    if (this.remoteOpenerServices.has(clientId)) {
      this.logger.error(`Remote opener service instance for client ${clientId} already set.`);
    }
    this.remoteOpenerServices.set(clientId, service);
  }

  removeRemoteOpenerServiceInstance(clientId: string): void {
    this.remoteOpenerServices.delete(clientId);
  }

  async openExternal(args: IExternalFileArgs | IExternalUrlArgs, clientId: string): Promise<void> {
    const service = this.remoteOpenerServices.get(clientId);

    if (!service) {
      // 没有命中ClientID时兜底强制打开
      if (this.remoteOpenerServices.values.length <= FORCE_OPEN_LIMIT) {
        this.remoteOpenerServices.forEach((service, clientId) => {
          service.openExternal({ ...args, clientId });
        });
      }

      this.logger.warn(`Remote opener service instance for client ${clientId} not found.`);
      return;
    }

    service.openExternal(args);
  }
}
