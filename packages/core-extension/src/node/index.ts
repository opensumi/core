import { Provider, Injectable, Autowired } from '@ali/common-di';
import { NodeModule, ServerAppContribution, IServerApp, Domain, AppConfig } from '@ali/ide-core-node';
import { CoreExtensionNodeServiceServerPath, CoreExtensionNodeService } from '../common';
import { CoreExtensionNodeServiceImpl } from './extension.service';

@Injectable()
export class CoreExtensionServerModule extends NodeModule {

  providers: Provider[] = [
    {
      token: CoreExtensionNodeService,
      useClass: CoreExtensionNodeServiceImpl,
    },
    CoreExtensionServerContribution,
  ];

  backServices = [
    {
      servicePath: CoreExtensionNodeServiceServerPath,
      token: CoreExtensionNodeService,
    },
  ];
}

@Domain(ServerAppContribution)
export class CoreExtensionServerContribution implements ServerAppContribution {

  @Autowired(CoreExtensionNodeService)
  service: CoreExtensionNodeServiceImpl;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  async initialize(app: IServerApp) {
    if (this.appConfig.coreExtensionDir) {
      await this.service.scanExtensions(this.appConfig.coreExtensionDir);
    }
    this.service.activateExtensions();

  }
}
