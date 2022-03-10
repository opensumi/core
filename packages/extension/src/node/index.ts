import { Provider, Injectable, Autowired } from '@opensumi/di';
import { NodeModule, ServerAppContribution, Domain, INodeLogger } from '@opensumi/ide-core-node';

import {
  IExtensionNodeService,
  ExtensionNodeServiceServerPath,
  IExtensionNodeClientService,
  ExtensionHostProfilerServicePath,
  ExtensionHostProfilerServiceToken,
  IExtensionHostManager,
} from '../common';

import { ExtensionHostManager } from './extension.host.manager';
import { ExtensionProfilerService } from './extension.profiler.service';
import { ExtensionNodeServiceImpl } from './extension.service';
import { ExtensionServiceClientImpl } from './extension.service.client';

@Injectable()
export class ExtensionModule extends NodeModule {
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
    ExtensionContribution,
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
export class ExtensionContribution implements ServerAppContribution {
  @Autowired(IExtensionNodeService)
  extensionNodeService: IExtensionNodeService;

  @Autowired(INodeLogger)
  logger;

  async initialize() {
    await this.extensionNodeService.initialize();
    this.logger.verbose('extension initialized');
  }

  async onStop() {
    await this.extensionNodeService.disposeAllClientExtProcess();
    this.logger.warn('extension exit by server stop');
  }
}
