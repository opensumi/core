import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import {
  CommonServerPath,
  Deferred,
  IApplicationService,
  ICommonServer,
  OS,
  OperatingSystem,
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
    const wsChannel = this.injector.get(WSChannelHandler);
    return wsChannel.clientId;
  }

  get windowId(): string | number {
    if (this.appConfig.isElectronRenderer) {
      return electronEnv.currentWindowId;
    } else {
      // web 场景先用 clientId
      const channelHandler = this.injector.get(WSChannelHandler);
      return channelHandler.clientId;
    }
  }
}
