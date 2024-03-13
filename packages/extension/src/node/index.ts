import { Autowired, Injectable, Provider } from '@opensumi/di';
import { Domain, INodeLogger, NodeModule, ServerAppContribution } from '@opensumi/ide-core-node';

import {
  ExtensionHostProfilerServicePath,
  ExtensionHostProfilerServiceToken,
  ExtensionNodeServiceServerPath,
  IExtensionHostManager,
  IExtensionNodeClientService,
  IExtensionNodeService,
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
  logger: INodeLogger;

  async initialize() {
    await this.extensionNodeService.initialize();
    this.logger.verbose('Extension server initialized');
  }

  async onStop() {
    await this.extensionNodeService.disposeAllClientExtProcess();
    this.logger.warn('All extension process exit by server stop');
  }
}
