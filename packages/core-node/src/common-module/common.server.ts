import { Injectable } from '@ide-framework/common-di';
import { ICommonServer, OS } from '@ide-framework/ide-core-common';

@Injectable()
export class CommonServer implements ICommonServer {
  async getBackendOS(): Promise<OS.Type> {
    return OS.type();
  }
}
