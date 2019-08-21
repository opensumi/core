import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { ExtensionNodeServiceServerPath, ExtensionService, ExtensionCapabilityRegistry /*Extension*/ } from '../common';
import { ExtensionServiceImpl /*ExtensionCapabilityRegistryImpl*/ } from './extension.service';
// import { ExtensionImpl } from './extension'

@Injectable()
export class KaitianExtensionModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    },
    // {
    //   token: Extension,
    //   useClass: ExtensionImpl
    // },
    KaitianExtensionClientAppContribution,
    // {
    //   token: ExtensionCapabilityRegistry,
    //   useClass: ExtensionCapabilityRegistryImpl
    // },
  ];

  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
    },
  ];
}

@Domain(ClientAppContribution)
export class KaitianExtensionClientAppContribution implements ClientAppContribution {
  @Autowired(ExtensionService)
  private extensionService: ExtensionService;

  async initialize() {
    this.extensionService.activate();
  }
}
