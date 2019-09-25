import { Provider, Injectable, Autowired } from '@ali/common-di';
import { NodeModule, ServerAppContribution, Domain } from '@ali/ide-core-node';
import { IExtensionNodeService, ExtensionNodeServiceServerPath, IExtensionNodeClientService } from '../common';
import { ExtensionNodeServiceImpl } from './extension.service';
import { ExtensionSeviceClientImpl } from './extension.service.client';

@Injectable()
export class KaitianExtensionModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionNodeService,
      useClass: ExtensionNodeServiceImpl,
    },
    {
      token: IExtensionNodeClientService,
      useClass: ExtensionSeviceClientImpl,
    },
    KaitianExtensionContribution,
  ];
  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      token: IExtensionNodeClientService,
    },
  ];
}

@Domain(ServerAppContribution)
export class KaitianExtensionContribution implements ServerAppContribution {

  @Autowired(IExtensionNodeService)
  extensionNodeService: IExtensionNodeService;

  async initialize() {
    // await (this.extensionNodeService as any).preCreateProcess();
    // console.log('kaitian ext pre create process');

    await (this.extensionNodeService as any).setExtProcessConnectionForward();
    console.log('kaitian ext setExtProcessConnectionForward');
  }

  async onStop() {
    if (process.env.KTELECTRON) {
      const clientId = process.env.CODE_WINDOW_CLIENT_ID as string;
      this.extensionNodeService.disposeClientExtProcess(clientId, true);
      console.log('kaitian extension exit');
    }
  }
}
