import { Injectable, Autowired } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { Uri } from '@opensumi/ide-core-common/lib/uri';

import {
  IExternalFileArgs,
  IExternalUrlArgs,
  IRemoteOpenerClient,
  IRemoteOpenerService,
  RemoteOpenerClientToken,
} from '../common';

@Injectable()
export class RemoteOpenerServiceImpl extends RPCService implements IRemoteOpenerService {
  private clientId: string | undefined;

  @Autowired(RemoteOpenerClientToken)
  private readonly remoteOpenerClient: IRemoteOpenerClient;

  setConnectionClientId(clientId: string): void {
    this.clientId = clientId;
    this.remoteOpenerClient.setRemoteOpenerServiceInstance(clientId, this);
  }

  removeConnectionClientId(clientId: string): void {
    this.remoteOpenerClient.removeRemoteOpenerServiceInstance(clientId);
  }

  async openExternal(args: IExternalFileArgs | IExternalUrlArgs): Promise<void> {
    if (args.clientId !== this.clientId) {
      throw new Error(`Unknown client id ${args.clientId}`);
    }

    try {
      await this.client.$openExternal(args.type, args.type === 'file' ? Uri.file(args.file) : Uri.parse(args.url));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`Error opening external error: ${err.message || err}`);
    }
  }
}
