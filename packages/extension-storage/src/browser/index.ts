import { IExtensionStorageService, IExtensionStoragePathServer, IExtensionStorageServer } from '../common';
import { Provider, Autowired } from '@opensumi/di';
import { BrowserModule, EffectDomain, ClientAppContribution, Domain } from '@opensumi/ide-core-browser';
import { ExtensionStorageService } from './storage.service';
import { ExtensionStoragePathServer } from './storage-path';
import { ExtensionStorageServer } from './storage';

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
