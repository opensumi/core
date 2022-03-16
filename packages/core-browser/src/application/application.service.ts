import { Injectable, Autowired } from '@opensumi/di';
import { OS, IApplicationService, CommonServerPath, ICommonServer, Deferred } from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers';

@Injectable()
export class ApplicationService implements IApplicationService {
  @Autowired(CommonServerPath)
  protected readonly commonServer: ICommonServer;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private _backendOS: OS.Type;

  private _initialized = new Deferred<void>();

  async initializeData() {
    this._backendOS = await this.commonServer.getBackendOS();
    this._initialized.resolve();
  }

  get frontendOS() {
    return OS.type();
  }

  get backendOS() {
    if (this._backendOS) {
      return this._backendOS;
    }
    // electron 作为 backend，可直接使用 frontend 的 os
    if (this.appConfig.isElectronRenderer) {
      return this.frontendOS;
    }
    throw new Error(
      "Can't get backend os type before initialize, if you want wait to get backend os, please use async method: getBackendOS",
    );
  }

  async getBackendOS() {
    await this._initialized.promise;
    return this.backendOS;
  }
}
