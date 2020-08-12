import { Injectable, Autowired } from '@ali/common-di';
import { OS, IApplicationService, CommonServerPath, ICommonServer } from '@ali/ide-core-common';

@Injectable()
export class ApplicationService implements IApplicationService {

  @Autowired(CommonServerPath)
  protected readonly commonServer: ICommonServer;

  private _backendOS: OS.Type;

  async getBackendOS() {
    if (!this._backendOS) {
      this._backendOS = await this.commonServer.getBackendOS();
    }
    return this._backendOS;
  }
}
