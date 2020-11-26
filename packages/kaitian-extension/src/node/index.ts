import { Provider, Injectable, Autowired } from '@ali/common-di';
import { NodeModule, ServerAppContribution, Domain, INodeLogger } from '@ali/ide-core-node';
import { IExtensionNodeService, ExtensionNodeServiceServerPath, IExtensionNodeClientService, ExtensionHostProfilerServicePath, ExtensionHostProfilerServiceToken, IExtensionHostManager } from '../common';
import { ExtensionNodeServiceImpl } from './extension.service';
import { ExtensionServiceClientImpl } from './extension.service.client';
import { ExtensionProfilerService } from './extension.profiler.service';
import { ExtensionHostManager } from './extension.host.manager';

@Injectable()
export class KaitianExtensionModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionNodeService,
      useClass: ExtensionNodeServiceImpl,
    },
    {
      token: IExtensionNodeClientService,
      useClass: ExtensionServiceClientImpl,
    },
    {
      token: ExtensionHostProfilerServiceToken,
      useClass: ExtensionProfilerService,
    },
    {
      token: IExtensionHostManager,
      useClass: ExtensionHostManager,
    },
    KaitianExtensionContribution,
  ];
  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      token: IExtensionNodeClientService,
    },
    {
      servicePath: ExtensionHostProfilerServicePath,
      token: ExtensionHostProfilerServiceToken,
    },
  ];
}

@Domain(ServerAppContribution)
export class KaitianExtensionContribution implements ServerAppContribution {

  @Autowired(IExtensionNodeService)
  extensionNodeService: IExtensionNodeService;

  @Autowired(INodeLogger)
  logger;

  async initialize() {
    await this.extensionNodeService.initialize();
    this.logger.verbose('kaitian ext initialize');
  }

  async onStop() {
    if (process.env.KTELECTRON) {
      const clientId = process.env.CODE_WINDOW_CLIENT_ID as string;
      await this.extensionNodeService.disposeClientExtProcess(clientId, true);
      this.logger.warn('kaitian extension exit by server stop');
    }
  }
}
