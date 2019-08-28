import { Provider, Injectable, Autowired } from '@ali/common-di';
import { NodeModule, ServerAppContribution, Domain } from '@ali/ide-core-node';
import { IExtensionNodeService, ExtensionNodeServiceServerPath } from '../common';
import { ExtensionNodeServiceImpl } from './extension.service';

@Injectable()
export class KaitianExtensionModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionNodeService,
      useClass: ExtensionNodeServiceImpl,
    },
    KaitianExtensionContribution,
  ];
  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      token: IExtensionNodeService,
    },
  ];
}

@Domain(ServerAppContribution)
export class KaitianExtensionContribution implements ServerAppContribution {

  @Autowired(IExtensionNodeService)
  extensionNodeService: IExtensionNodeService;

  async initialize() {
    await (this.extensionNodeService as any).preCreateProcess();
    console.log('kaitian ext pre create process');
  }
}
