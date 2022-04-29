import { Injectable } from '@opensumi/di';
import { ICommonServer, OS, OperatingSystem } from '@opensumi/ide-core-common';

@Injectable()
export class CommonServer implements ICommonServer {
  async getBackendOS(): Promise<OperatingSystem> {
    return OS.type();
  }
}
