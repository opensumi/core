import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ClientAppContribution, Domain, SlotLocation, localize, IPreferenceSettingsService, CommandContribution, CommandRegistry, IClientApp } from '@ali/ide-core-browser';
import { ExtensionNodeServiceServerPath, ExtensionService, ExtensionCapabilityRegistry /*Extension*/ } from '../common';
import { ExtensionServiceImpl /*ExtensionCapabilityRegistryImpl*/ } from './extension.service';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
// import { ExtensionImpl } from './extension'
import { IDebugServer } from '@ali/ide-debug';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';
import { DebugSessionContributionRegistry } from '@ali/ide-debug/lib/browser';
import { getIcon } from '@ali/ide-core-browser';

const RELOAD_WINDOW_COMMAND = {
  id: 'reload_window',
};

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
      override: true,
    },
    {
      token: DebugSessionContributionRegistry,
      useClass: ExtensionDebugSessionContributionRegistry,
      override: true,
    },
    KaitianExtensionClientAppContribution,
  ];

  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      clientToken: ExtensionService,
    },
  ];
}

@Domain(ClientAppContribution, CommandContribution)
export class KaitianExtensionClientAppContribution implements ClientAppContribution, CommandContribution {
  @Autowired(ExtensionService)
  private extensionService: ExtensionService;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(IPreferenceSettingsService)
  preferenceSettingsService: IPreferenceSettingsService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  async initialize() {
    await this.extensionService.activate();
  }

  async onStart() {
    this.preferenceSettingsService.registerSettingGroup({
      id: 'extension',
      title: localize('settings.group.extension'),
      iconClass: getIcon('setting-extension'),
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(RELOAD_WINDOW_COMMAND, {
      execute: () => {
        this.clientApp.fireOnReload();
      },
    });
  }
}
