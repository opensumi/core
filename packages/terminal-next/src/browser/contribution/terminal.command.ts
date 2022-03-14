import { Autowired } from '@opensumi/di';
import {
  URI,
  Domain,
  getIcon,
  AppConfig,
  CommandService,
  COMMON_COMMANDS,
  CommandRegistry,
  PreferenceService,
  CommandContribution,
  IPreferenceSettingsService,
  ILogger,
  IClipboardService,
  PreferenceScope,
} from '@opensumi/ide-core-browser';

import {
  ITerminalController,
  ITerminalRestore,
  ITerminalGroupViewService,
  ITerminalSearchService,
  ITerminalApiService,
  TERMINAL_COMMANDS,
} from '../../common';
import { TerminalEnvironmentService } from '../terminal.environment.service';
import { TerminalKeyBoardInputService } from '../terminal.input';

import { EnvironmentVariableServiceToken } from './../../common/environmentVariable';


@Domain(CommandContribution)
export class TerminalCommandContribution implements CommandContribution {
  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(EnvironmentVariableServiceToken)
  protected readonly terminalEnvironmentService: TerminalEnvironmentService;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalSearchService)
  protected readonly search: ITerminalSearchService;

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

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(IClipboardService)
  protected readonly clipboardService: IClipboardService;

  onReconnect() {
    this.terminalController.reconnect();
  }

  registerCommands(registry: CommandRegistry) {
    // 搜索
    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.OPEN_SEARCH,
        iconClass: getIcon('search'),
      },
      {
        execute: () => {
          this.search.open();
        },
      },
    );

    // 分屏
    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.SPLIT,
        iconClass: getIcon('embed'),
      },
      {
        execute: () => {
          const group = this.view.currentGroup;
          const widget = this.view.createWidget(group);
          this.view.selectWidget(widget.id);
        },
      },
    );

    // 删除所有终端
    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.CLEAR,
      },
      {
        execute: () => {
          this.view.clear();
        },
      },
    );

    registry.registerCommand(TERMINAL_COMMANDS.SEARCH_NEXT, {
      execute: () => {
        if (this.search.show) {
          this.search.search();
        } else {
          this.search.open();
        }
      },
    });

    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.REMOVE,
        iconClass: getIcon('delete'),
      },
      {
        execute: async () => {
          const widgetId = this.view.currentWidgetId;
          if (widgetId) {
            this.view.removeWidget(widgetId);
          }
        },
      },
    );

    registry.registerCommand(TERMINAL_COMMANDS.OPEN_WITH_PATH, {
      execute: async (uri: URI) => {
        if (uri) {
          const client = await this.terminalApi.createTerminal({ cwd: uri.codeUri.fsPath });
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

    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.SELECT_ALL_CONTENT,
      },
      {
        execute: () => {
          const widgetId = this.view.currentWidgetId;
          const client = this.terminalController.findClientFromWidgetId(widgetId);
          if (client) {
            client.selectAll();
          }
        },
      },
    );

    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.CLEAR_CONTENT,
        iconClass: getIcon('clear'),
      },
      {
        execute: () => {
          const current = this.view.currentWidgetId;
          const client = this.terminalController.findClientFromWidgetId(current);
          if (client) {
            client.clear();
          }
        },
      },
    );

    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.CLEAR_ALL_CONTENT,
      },
      {
        execute: () => {
          this.terminalController.clearAllGroups();
        },
      },
    );

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_ZSH, {
      execute: async () => {
        this.preference.set('terminal.type', 'zsh', PreferenceScope.User);
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_BASH, {
      execute: async () => {
        this.preference.set('terminal.type', 'bash', PreferenceScope.User);
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_SH, {
      execute: async () => {
        this.preference.set('terminal.type', 'sh', PreferenceScope.User);
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_POWERSHELL, {
      execute: async () => {
        this.preference.set('terminal.type', 'powershell', PreferenceScope.User);
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_CMD, {
      execute: async () => {
        this.preference.set('terminal.type', 'cmd', PreferenceScope.User);
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.MORE_SETTINGS, {
      execute: async () => {
        this.commands.executeCommand(COMMON_COMMANDS.LOCATE_PREFERENCES.id, 'terminal');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.COPY, {
      execute: async () => {
        const current = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(current);
        if (client) {
          await this.clipboardService.writeText(client.getSelection());
        }
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.PASTE, {
      execute: async () => {
        const current = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(current);
        if (client) {
          client.paste(await this.clipboardService.readText());
        }
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_ALL, {
      execute: () => {
        const current = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(current);
        if (client) {
          client.selectAll();
        }
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.RE_LAUNCH, {
      execute: () => {
        const groups = this.view.groups;
        for (const group of groups) {
          group.widgets.forEach((widget) => {
            const client = this.terminalController.findClientFromWidgetId(widget.id);
            if (client) {
              client.reset();
            }
          });
        }
      },
    });

    registry.registerCommand(COMMON_COMMANDS.ENVIRONMENT_VARIABLE, {
      execute: async () => {
        const env = await this.terminalEnvironmentService.getProcessEnv();
        return env;
      },
    });
  }
}
