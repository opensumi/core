import { Injectable } from '@ali/common-di';
import { ICommonServer, OS } from '@ali/ide-core-common';

@Injectable()
export class CommonServer implements ICommonServer {
  async getBackendOS(): Promise<OS.Type> {
    return OS.type();
  }
}
