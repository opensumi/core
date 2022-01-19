import { Injectable } from '@opensumi/di';

import { IExternalFileArgs, IExternalUrlArgs, IRemoteOpenerClient, IRemoteOpenerService } from '../common';

@Injectable()
export class RemoteOpenerClientImpl implements IRemoteOpenerClient {
  private remoteOpenerServices: Map<string, IRemoteOpenerService> = new Map();

  setRemoteOpenerServiceInstance(clientId: string, service: IRemoteOpenerService): void {
    if (this.remoteOpenerServices.has(clientId)) {
      throw new Error(`Remote opener service instance for client ${clientId} already set.`);
    }
    this.remoteOpenerServices.set(clientId, service);
  }

  async openExternal(args: IExternalFileArgs | IExternalUrlArgs, clientId: string): Promise<void> {
    const service = this.remoteOpenerServices.get(clientId);
    if (!service) {
      throw new Error(`Remote opener service instance for client ${clientId} not set.`);
    }

    service.openExternal(args);
  }
}
