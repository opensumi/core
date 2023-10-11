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
  TerminalSettingsId,
  TERMINAL_COMMANDS,
} from '@opensumi/ide-core-browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import {
  ITerminalController,
  ITerminalRestore,
  ITerminalGroupViewService,
  ITerminalSearchService,
  ITerminalApiService,
  ITerminalClient,
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

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

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

  private setDefaultTerminalType(type: string) {
    this.preference.update(TerminalSettingsId.Type, type);
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
          if (this.search.show) {
            this.search.close();
            return;
          }
          this.search.open();
        },
      },
    );

    // 拆分终端
    registry.registerCommand(
      {
        ...TERMINAL_COMMANDS.SPLIT,
        iconClass: getIcon('embed'),
      },
      {
        execute: () => {
          const group = this.view.currentGroup;
          if (!group) {
            return;
          }
          const widget = this.view.createWidget(group);
          this.view.selectWidget(widget.id);
        },
      },
    );

    // 删除所有终端
    registry.registerCommand(TERMINAL_COMMANDS.CLEAR, {
      execute: () => {
        this.view.clear();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.ADD, {
      execute: async () => {
        await this.terminalController.createTerminalWithWidget({});
        this.terminalController.showTerminalPanel();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.TOGGLE_TERMINAL, {
      execute: () => {
        this.terminalController.toggleTerminalPanel();
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
        this.setDefaultTerminalType('zsh');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_BASH, {
      execute: async () => {
        this.setDefaultTerminalType('bash');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_SH, {
      execute: async () => {
        this.setDefaultTerminalType('sh');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_POWERSHELL, {
      execute: async () => {
        this.setDefaultTerminalType('powershell');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.SELECT_CMD, {
      execute: async () => {
        this.setDefaultTerminalType('cmd');
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.MORE_SETTINGS, {
      execute: async () => {
        this.commands.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id, 'terminal');
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

    registry.registerCommand(TERMINAL_COMMANDS.FOCUS_NEXT_TERMINAL, {
      execute: () => {
        const group = this.view.currentGroup;
        if (group.widgets.length <= 1) {
          return;
        }
        const client = this.getNextOrPrevTerminalClient('next');
        client?.focus();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.FOCUS_PREVIOUS_TERMINAL, {
      execute: () => {
        const group = this.view.currentGroup;
        if (group.widgets.length <= 1) {
          return;
        }
        const client = this.getNextOrPrevTerminalClient('prev');
        client?.focus();
      },
    });

    registry.registerCommand(TERMINAL_COMMANDS.KILL_PROCESS, {
      execute: async () => {
        const current = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(current);
        if (client) {
          const select = client.getSelection();
          if (select && select.length > 0) {
            // 有选择内容则复制到剪贴板
            await this.clipboardService.writeText(client.getSelection());
          } else {
            // 没有选择内容则执行结束进程命令
            await this.terminalApi.sendText(current, '\x03');
          }
        }
      },
    });
  }

  private getNextOrPrevTerminalClient(kind: 'next' | 'prev'): ITerminalClient | undefined {
    const group = this.view.currentGroup;
    const currentIdx = group.widgets.findIndex((w) => w.id === this.view.currentWidgetId);

    let index;
    if (kind === 'next') {
      index = currentIdx === group.widgets.length - 1 ? 0 : currentIdx + 1;
    } else {
      index = currentIdx === 0 ? group.widgets.length - 1 : currentIdx - 1;
    }

    const widget = group.widgets[index];
    return this.terminalController.findClientFromWidgetId(widget.id);
  }
}
