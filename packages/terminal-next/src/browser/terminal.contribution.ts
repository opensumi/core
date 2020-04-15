import {
  Domain,
  localize,
  ComponentContribution,
  ComponentRegistry,
  CommandContribution,
  CommandRegistry,
  TabBarToolbarContribution,
  ToolbarRegistry,
  ClientAppContribution,
  URI,
  PreferenceService,
  IPreferenceSettingsService,
  CommandService,
  AppConfig,
  COMMON_COMMANDS,
  getIcon,
} from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { ITerminalController, ITerminalRestore, ITerminalGroupViewService, ITerminalSearchService, ITerminalApiService, TERMINAL_COMMANDS } from '../common';
import TerminalTabs from './component/tab.view';
import { TerminalKeyBoardInputService } from './terminal.input';
import TerminalView from './component/terminal.view';

@Domain(ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution)
export class TerminalBrowserContribution implements ComponentContribution, CommandContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution {

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalSearchService)
  protected readonly search: ITerminalSearchService;

  @Autowired(IMainLayoutService)
  protected readonly layoutService: IMainLayoutService;

  @Autowired(ITerminalRestore)
  protected readonly store: ITerminalRestore;

  @Autowired(ITerminalApiService)
  protected readonly terminalApi: ITerminalApiService;

  @Autowired(PreferenceService)
  protected readonly preference: PreferenceService;

  @Autowired(IPreferenceSettingsService)
  protected readonly settingService: IPreferenceSettingsService;

  @Autowired(CommandService)
  protected readonly commands: CommandService;

  @Autowired(AppConfig)
  protected readonly config: AppConfig;

  @Autowired()
  protected readonly terminalInput: TerminalKeyBoardInputService;

  onReconnect() {
    this.terminalController.reconnect();
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-terminal-next', {
      component: TerminalView,
      id: 'ide-terminal-next',
    }, {
      title: localize('terminal.name'),
      priority: 1,
      activateKeyBinding: 'ctrl+`',
      containerId: 'terminal',
      titleComponent: TerminalTabs,
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      ...TERMINAL_COMMANDS.OPEN_SEARCH,
      iconClass: getIcon('search'),
    }, {
      execute: () => {
        this.search.open();
      },
    });

    registry.registerCommand({
      ...TERMINAL_COMMANDS.SPLIT,
      iconClass: getIcon('embed'),
    }, {
      execute: () => {
        const group = this.view.currentGroup;
        const widget = this.view.createWidget(group);
        this.view.selectWidget(widget.id);
      },
    });

    registry.registerCommand({
      ...TERMINAL_COMMANDS.CLEAR,
    }, {
      execute: () => {
        this.view.clear();
        this.terminalController.hideTerminalPanel();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SEARCH_NEXT, {
      execute: () => {
        if (this.search.show) {
          this.search.search();
        } else {
          this.search.open();
        }
      },
    });

    registry.registerCommand({
      ...TERMINAL_COMMANDS.REMOVE,
      iconClass: getIcon('delete'),
    }, {
      execute: async (_: any, index: number) => {
        if (index !== -1) {
          this.view.removeGroup(index);
        }
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.OPEN_WITH_PATH, {
      execute: (uri: URI) => {
        if (uri) {
          const client = this.terminalApi.createTerminal({ cwd: uri.codeUri.fsPath });
          client.show();
        }
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.TAB_RENAME, {
      execute: async (_: any, index: number) => {
        const group = this.view.getGroup(index);
        if (group) {
          group.edit();
        }
      },
    });

    registry.registerCommand({
      ...TERMINAL_COMMANDS.SELECT_ALL_CONTENT,
    }, {
      execute: () => {
        const widgetId = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(widgetId);
        if (client) {
          client.selectAll();
        }
      },
    });

    registry.registerCommand({
      ...TERMINAL_COMMANDS.CLEAR_CONTENT,
      iconClass: getIcon('clear'),
    }, {
      execute: () => {
        this.terminalController.clearCurrentGroup();
      },
    });

    registry.registerCommand({
      ...TERMINAL_COMMANDS.CLEAR_ALL_CONTENT,
    }, {
      execute: () => {
        this.terminalController.clearAllGroups();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_ZSH, {
      execute: async () => {
        this.preference.set('terminal.type', 'zsh');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_BASH, {
      execute: async () => {
        this.preference.set('terminal.type', 'bash');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_SH, {
      execute: async () => {
        this.preference.set('terminal.type', 'sh');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.MORE_SETTINGS, {
      execute: async () => {
        this.commands.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id);
        this.settingService.setCurrentGroup('terminal');
      },
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: TERMINAL_COMMANDS.OPEN_SEARCH.id,
      command: TERMINAL_COMMANDS.OPEN_SEARCH.id,
      viewId: TERMINAL_COMMANDS.OPEN_SEARCH.category,
      tooltip: localize('terminal.search'),
    });
    registry.registerItem({
      id: TERMINAL_COMMANDS.SPLIT.id,
      command: TERMINAL_COMMANDS.SPLIT.id,
      viewId: TERMINAL_COMMANDS.SPLIT.category,
      tooltip: localize('terminal.split'),
    });
    registry.registerItem({
      id: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
      command: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
      viewId: TERMINAL_COMMANDS.CLEAR_CONTENT.category,
      tooltip: localize('terminal.menu.clearGroups'),
    });
  }

  onStart() {
    this.terminalInput.listen();
  }

  onDidRender() {
    this.store.restore()
      .then(() => {
        this.terminalController.firstInitialize();
      });
  }

  onStop() {
    this.store.save();
  }
}
