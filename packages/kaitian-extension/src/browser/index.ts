import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, ClientAppContribution, Domain, localize, IPreferenceSettingsService, CommandContribution, CommandRegistry, IClientApp, IEventBus, CommandService, IAsyncResult } from '@ali/ide-core-browser';
import { ExtensionNodeServiceServerPath, ExtensionService, EMIT_EXT_HOST_EVENT} from '../common';
import { ExtensionServiceImpl } from './extension.service';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IDebugServer } from '@ali/ide-debug';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';
import { DebugSessionContributionRegistry } from '@ali/ide-debug/lib/browser';
import { getIcon } from '@ali/ide-core-browser';
import { ExtHostEvent, Serializable } from './types';
import { ActivationEventService } from '@ali/ide-activation-event/lib/browser';
import { FileSearchServicePath } from '@ali/ide-file-search/lib/common';

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
    {
      servicePath: FileSearchServicePath,
    },
  ];
}

@Domain(ClientAppContribution, CommandContribution)
export class KaitianExtensionClientAppContribution implements ClientAppContribution, CommandContribution {
  @Autowired(ExtensionService)
  private extensionService: ExtensionService;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(ActivationEventService)
  activationEventService: ActivationEventService;

  @Autowired(IPreferenceSettingsService)
  preferenceSettingsService: IPreferenceSettingsService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  commandService: CommandService;

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
    registry.registerCommand(EMIT_EXT_HOST_EVENT, {
      execute: async (eventName: string, ...eventArgs: Serializable[]) => {
        // activationEvent 添加 onEvent:xxx
        await this.activationEventService.fireEvent('onEvent:' + eventName);
        const results = await this.eventBus.fireAndAwait<any[]>(new ExtHostEvent({
          eventName,
          eventArgs,
        }));
        const mergedResults: IAsyncResult<any[]>[] = [];
        results.forEach((r) => {
          if (r.err) {
            mergedResults.push(r);
          } else {
            mergedResults.push(...r.result! || []);
          }
        });
        return mergedResults;
      },
    });
  }
}
