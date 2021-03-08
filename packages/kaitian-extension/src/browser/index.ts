import { Provider, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IContextKeyService, BrowserModule, ClientAppContribution, Domain, localize, IPreferenceSettingsService, CommandContribution, CommandRegistry, IClientApp, IEventBus, CommandService, IAsyncResult, MonacoContribution, QuickOpenService, QuickOpenItem, QuickOpenItemOptions, QuickOpenGroupItem, replaceLocalizePlaceholder, isElectronEnv, electronEnv, formatLocalize, FILE_COMMANDS, URI } from '@ali/ide-core-browser';
import { ExtensionNodeServiceServerPath, ExtensionService, EMIT_EXT_HOST_EVENT, ExtensionHostType, ExtensionHostProfilerServicePath, IExtensionHostProfilerService, IExtensionNodeClientService} from '../common';
import { ExtensionServiceImpl } from './extension.service';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IDebugServer } from '@ali/ide-debug';
import { ExtensionDebugService, ExtensionDebugSessionContributionRegistry } from './vscode/api/debug';
import { DebugSessionContributionRegistry } from '@ali/ide-debug/lib/browser';
import { getIcon } from '@ali/ide-core-browser';
import { ExtHostEvent, Serializable, IActivationEventService, ExtensionApiReadyEvent } from './types';
import { FileSearchServicePath } from '@ali/ide-file-search/lib/common';
import { ActivationEventServiceImpl } from './activation.service';
import { VSCodeCommands } from './vscode/commands';
import { IWebviewService } from '@ali/ide-webview';
import { ActivatedExtension } from '../common/activator';
import { WSChannelHandler } from '@ali/ide-connection/lib/browser/ws-channel-handler';
import { IWindowDialogService } from '@ali/ide-overlay';
import { IStatusBarService, StatusBarAlignment, StatusBarEntryAccessor } from '@ali/ide-core-browser/lib/services/status-bar-service';
import * as BUILTIN_COMMANDS from './builtin-commands';
import type * as vscode from 'vscode';

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
    {
      token: IActivationEventService,
      useClass: ActivationEventServiceImpl,
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
    {
      servicePath: ExtensionHostProfilerServicePath,
    },
  ];
}

@Domain(ClientAppContribution, CommandContribution, MonacoContribution)
export class KaitianExtensionClientAppContribution implements ClientAppContribution, CommandContribution, MonacoContribution {
  @Autowired(ExtensionService)
  private extensionService: ExtensionService;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(IActivationEventService)
  activationEventService: IActivationEventService;

  @Autowired(IPreferenceSettingsService)
  preferenceSettingsService: IPreferenceSettingsService;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  @Autowired(ExtensionHostProfilerServicePath)
  private extensionProfiler: IExtensionHostProfilerService;

  @Autowired(IStatusBarService)
  protected readonly statusBar: IStatusBarService;

  @Autowired(IWindowDialogService)
  private readonly dialogService: IWindowDialogService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeService: IExtensionNodeClientService;

  private cpuProfileStatus: StatusBarEntryAccessor | null;

  async initialize() {
    await this.extensionService.activate();
    const disposer = this.webviewService.registerWebviewReviver({
      handles: (id: string) => 0,
      revive: (id: string) => {
        return new Promise<void>((resolve) => {
          this.eventBus.on(ExtensionApiReadyEvent, () => {
            disposer.dispose();
            resolve(this.webviewService.tryReviveWebviewComponent(id));
          });
        });
      },
    });
  }

  async onStart() {
    this.preferenceSettingsService.registerSettingGroup({
      id: 'extension',
      title: localize('settings.group.extension'),
      iconClass: getIcon('extension'),
    });
  }

  onStop() {
    // IDE 关闭或者重启时销毁插件进程
    this.extensionNodeService.disposeClientExtProcess(this.clientId, false);
  }

  onContextKeyServiceReady(contextKeyService: IContextKeyService) {
    // `listFocus` 为 vscode 旧版 api，已经废弃，默认设置为 true
    contextKeyService.createKey('listFocus', true);
  }

  registerCommands(registry: CommandRegistry) {
    // vscode `setContext` for extensions
    // only works for global scoped context
    registry.registerCommand(VSCodeCommands.SET_CONTEXT, {
      execute: (contextKey: any, contextValue: any) => {
        this.contextKeyService.createKey(String(contextKey), contextValue);
      },
    });

    registry.registerCommand(BUILTIN_COMMANDS.RELOAD_WINDOW_COMMAND, {
      execute: () => {
        this.clientApp.fireOnReload();
      },
    });
    registry.registerCommand(BUILTIN_COMMANDS.RELOAD_WINDOW);
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

    registry.registerCommand(BUILTIN_COMMANDS.SHOW_RUN_TIME_EXTENSION, {
      execute: async () => {
        const activated = await this.extensionService.getActivatedExtensions();
        this.quickOpenService.open({
          onType: (lookFor: string, acceptor) => acceptor(this.asQuickOpenItems(activated)),
        }, { placeholder: '运行中的插件' });
      },
    });

    registry.registerCommand(BUILTIN_COMMANDS.START_EXTENSION_HOST_PROFILER, {
      execute: async () => {
        if (!this.cpuProfileStatus) {
          this.cpuProfileStatus = this.statusBar.addElement('ExtensionHostProfile', {
            tooltip: formatLocalize('extension.profiling.clickStop', 'Click to stop profiling.'),
            text: `$(sync~spin) ${formatLocalize('extension.profilingExtensionHost', 'Profiling Extension Host')}`,
            alignment: StatusBarAlignment.RIGHT,
            command: BUILTIN_COMMANDS.STOP_EXTENSION_HOST_PROFILER.id,
          });
        }
        await this.extensionProfiler.$startProfile(this.clientId);
      },
      isPermitted: () => false,
    });

    registry.registerCommand(BUILTIN_COMMANDS.STOP_EXTENSION_HOST_PROFILER, {
      execute: async () => {
        const successful = await this.extensionProfiler.$stopProfile(this.clientId);

        if (this.cpuProfileStatus) {
          this.cpuProfileStatus.dispose();
          this.cpuProfileStatus = null;
        }

        if (successful) {
          const saveUri = await this.dialogService.showSaveDialog({
            saveLabel: formatLocalize('extension.profile.save', 'Save Extension Host Profile'),
            showNameInput: true,
            defaultFileName: `CPU-${new Date().toISOString().replace(/[\-:]/g, '')}.cpuprofile`,
          });
          if (saveUri?.codeUri) {
            await this.extensionProfiler.$saveLastProfile(saveUri?.codeUri.fsPath);
          }
        }
      },
      isPermitted: () => false,
    });

    registry.registerCommand(BUILTIN_COMMANDS.CLEAR_TERMINAL);
    registry.registerCommand(BUILTIN_COMMANDS.COPY_FILE_PATH, {
      execute: async (uri: vscode.Uri) => {
        await this.commandService.executeCommand(FILE_COMMANDS.COPY_PATH.id, URI.from(uri));
      },
    });
    registry.registerCommand(BUILTIN_COMMANDS.COPY_RELATIVE_FILE_PATH, {
      execute: async (uri: vscode.Uri) => {
        await this.commandService.executeCommand(FILE_COMMANDS.COPY_RELATIVE_PATH.id, URI.from(uri));
      },
    });
    registry.registerCommand(BUILTIN_COMMANDS.SETTINGS_COMMAND_OPEN_SETTINGS);
    registry.registerCommand(BUILTIN_COMMANDS.QPEN_COMMAND_PALETTE);
    // editor builtin commands
    registry.registerCommand(BUILTIN_COMMANDS.EDITOR_NAVIGATE_BACK);
    registry.registerCommand(BUILTIN_COMMANDS.EDITOR_NAVIGATE_FORWARD);
    registry.registerCommand(BUILTIN_COMMANDS.EDITOR_SAVE_ALL);
    // debug builtin commands
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_STEP_INTO);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_STEP_OVER);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_STEP_OUT);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_CONTINUE);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_RUN);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_START);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_PAUSE);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_RESTART);
    registry.registerCommand(BUILTIN_COMMANDS.DEBUG_COMMAND_STOP);

  }

  asQuickOpenItems(activated: { node?: ActivatedExtension[] | undefined; worker?: ActivatedExtension[] | undefined; }): QuickOpenItem<QuickOpenItemOptions>[] {
    const nodes = activated.node ? activated.node.map((e, i) => this.toQuickOpenItem(e, 'node', i === 0)) : [];
    const workers = activated.worker ? activated.worker.map((e, i) => this.toQuickOpenItem(e, 'worker', i === 0)) : [];
    return [
      ...nodes,
      ...workers,
    ];
  }

  toQuickOpenItem(e: ActivatedExtension, host: ExtensionHostType, firstItem: boolean): QuickOpenItem<QuickOpenItemOptions> {
    const extension = this.extensionService.getExtensionByExtId(e.id);
    return new QuickOpenGroupItem({
      groupLabel: firstItem ? host : undefined,
      showBorder: !!firstItem,
      label: replaceLocalizePlaceholder(e.displayName, e.id),
      description: replaceLocalizePlaceholder(e.description, e.id),
      detail: extension?.realPath,
    });
  }

  /**
   * 当前客户端 id
   */
  private get clientId() {
    let clientId: string;
    if (isElectronEnv()) {
      clientId = electronEnv.metadata.windowClientId;
    } else {
      const channelHandler = this.injector.get(WSChannelHandler);
      clientId = channelHandler.clientId;
    }
    return clientId;
  }
}
