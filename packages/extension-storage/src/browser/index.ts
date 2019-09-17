import { ExtensionStorageServerPath, IExtensionStorageService } from '../common';
import { Provider, Autowired } from '@ali/common-di';
import { BrowserModule, EffectDomain, ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { ExtensionStorageService } from './storage.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class ExtensionStorageModule extends BrowserModule {
  providers: Provider[] = [{
    token: IExtensionStorageService,
    useClass: ExtensionStorageService,
  },
  ExtensionStorageContribution,
];

  // 依赖 Node 服务
  backServices = [{
    servicePath: ExtensionStorageServerPath,
  }];
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
