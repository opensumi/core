import { Provider, Injectable, Autowired } from '@ide-framework/common-di';
import { NodeModule, ServerAppContribution, Domain, INodeLogger } from '@ide-framework/ide-core-node';
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
    await this.extensionNodeService.disposeAllClientExtProcess();
    this.logger.warn('kaitian extension exit by server stop');
  }
}
