import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ClientAppContribution, Domain } from '@ali/ide-core-browser';
import { ExtensionNodeServiceServerPath, ExtensionService, ExtensionCapabilityRegistry /*Extension*/ } from '../common';
import { ExtensionServiceImpl /*ExtensionCapabilityRegistryImpl*/ } from './extension.service';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
// import { ExtensionImpl } from './extension'
import { ViewRegistry } from './vscode/view-registry'

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

@Domain(ClientAppContribution, MainLayoutContribution)
export class KaitianExtensionClientAppContribution implements ClientAppContribution {
  @Autowired(ExtensionService)
  private extensionService: ExtensionService;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired()
  viewRegistry: ViewRegistry;

  async initialize() {
    await this.extensionService.activate();
  }

  onDidUseConfig() {
    for (const location of this.viewRegistry.viewsMap.keys()) {
      const handler = this.mainLayoutService.getTabbarHandler(location);
      for (const view of this.viewRegistry.viewsMap.get(location)!) {
        // TODO 插件进程这里注册两次是不是没有必要？(dataProvider加载后还注册了一次)
        handler!.registerView(view as any, view.component!, {});
      }
    }
  }
}
