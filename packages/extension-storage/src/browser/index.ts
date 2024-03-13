import { Autowired, Provider } from '@opensumi/di';
import { BrowserModule, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';

import { IExtensionStoragePathServer, IExtensionStorageServer, IExtensionStorageService } from '../common';

import { ExtensionStorageServer } from './storage';
import { ExtensionStoragePathServer } from './storage-path';
import { ExtensionStorageService } from './storage.service';

const pkgJson = require('../../package.json');
@Domain(pkgJson.name)
export class ExtensionStorageModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IExtensionStorageService,
      useClass: ExtensionStorageService,
    },
    {
      token: IExtensionStoragePathServer,
      useClass: ExtensionStoragePathServer,
    },
    {
      token: IExtensionStorageServer,
      useClass: ExtensionStorageServer,
    },
    ExtensionStorageContribution,
  ];
}

@Domain(ClientAppContribution)
export class ExtensionStorageContribution implements ClientAppContribution {
  @Autowired(IExtensionStorageService)
  private extensionStorageService: IExtensionStorageService;

  onReconnect() {
    this.extensionStorageService.reConnectInit();
  }
}

export * from './storage.service';
