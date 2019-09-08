import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ClientAppContribution, Domain, SlotLocation } from '@ali/ide-core-browser';
import { ExtensionNodeServiceServerPath, ExtensionService, ExtensionCapabilityRegistry /*Extension*/ } from '../common';
import { ExtensionServiceImpl /*ExtensionCapabilityRegistryImpl*/ } from './extension.service';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
// import { ExtensionImpl } from './extension'
import { ViewRegistry } from './vscode/view-registry';
import { IDebugServer } from '@ali/ide-debug';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';
import { DebugSessionContributionRegistry } from '@ali/ide-debug/lib/browser';

@Injectable()
export class KaitianExtensionModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    },
    {
      token: IDebugServer,
      useClass: ExtensionDebugService,
    },
    {
      token: DebugSessionContributionRegistry,
      useClass: ExtensionDebugSessionContributionRegistry,
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
export class KaitianExtensionClientAppContribution implements ClientAppContribution, MainLayoutContribution {
  @Autowired(ExtensionService)
  private extensionService: ExtensionService;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired()
  viewRegistry: ViewRegistry;

  async initialize() {
    await this.extensionService.activate();
  }

  onStart() {
    for (const containerId of this.viewRegistry.viewsMap.keys()) {
      const views = this.viewRegistry.viewsMap.get(containerId);
      const containerOption = this.viewRegistry.containerMap.get(containerId);
      if (views) {
        // 内置的container
        if (containerOption) {
          // 自定义viewContainer
          this.mainLayoutService.collectTabbarComponent(views, containerOption, SlotLocation.left);
        }
      } else {
        console.warn('注册了一个没有view的viewContainer!');
      }
    }
  }

  onDidUseConfig() {
    for (const containerId of this.viewRegistry.viewsMap.keys()) {
      const views = this.viewRegistry.viewsMap.get(containerId);
      const containerOption = this.viewRegistry.containerMap.get(containerId);
      if (!containerOption) {
        const handler = this.mainLayoutService.getTabbarHandler(containerId);
        for (const view of views || []) {
          handler!.registerView(view as any, view.component!, {});
        }
      }
    }
  }
}
