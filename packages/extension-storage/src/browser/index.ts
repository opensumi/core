import { Provider, Autowired } from '@opensumi/di';
import { BrowserModule, EffectDomain, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';

import { IExtensionStorageService, IExtensionStoragePathServer, IExtensionStorageServer } from '../common';

import { ExtensionStorageServer } from './storage';
import { ExtensionStoragePathServer } from './storage-path';
import { ExtensionStorageService } from './storage.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
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
  private extensionStorageService;

  onReconnect() {
    this.extensionStorageService.reConnectInit();
  }
}

export * from './storage.service';
