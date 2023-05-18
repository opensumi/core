import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import {
  OS,
  OperatingSystem,
  IApplicationService,
  CommonServerPath,
  ICommonServer,
  Deferred,
} from '@opensumi/ide-core-common';

import { AppConfig } from '../react-providers/config-provider';
import { electronEnv } from '../utils/electron';

@Injectable()
export class ApplicationService implements IApplicationService {
  @Autowired(CommonServerPath)
  protected readonly commonServer: ICommonServer;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  private _backendOS: OperatingSystem;

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

  get clientId(): string {
    if (this.appConfig.isElectronRenderer && !this.appConfig.isRemote) {
      return electronEnv.metadata.windowClientId;
    } else {
      const wsChannel = this.injector.get(WSChannelHandler);
      return wsChannel.clientId;
    }
  }
}
