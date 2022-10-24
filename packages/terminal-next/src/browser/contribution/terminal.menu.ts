import { Autowired } from '@opensumi/di';
import {
  localize,
  PreferenceService,
  IPreferenceSettingsService,
  getSlotLocation,
  AppConfig,
  getTabbarCtxKey,
  TERMINAL_COMMANDS,
} from '@opensumi/ide-core-browser';
import { TERMINAL_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import {
  MenuContribution,
  IMenuRegistry,
  getTabbarCommonMenuId,
  MenuId as CoreMenuId,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Domain, CommandService, isWindows } from '@opensumi/ide-core-common';

import { ITerminalController, ITerminalGroupViewService, ITerminalSearchService } from '../../common';

export const group = 'panel_menu';
export const more1 = 'more_1';
export const more1Sub = 'more_1_sub';
export const more2 = 'more_2';

@Domain(MenuContribution)
export class TerminalMenuContribution implements MenuContribution {
  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalSearchService)
  protected readonly search: ITerminalSearchService;

  @Autowired(IPreferenceSettingsService)
  protected readonly settingService: IPreferenceSettingsService;

  @Autowired(CommandService)
  protected readonly commands: CommandService;

  @Autowired(AppConfig)
  protected readonly config: AppConfig;

  @Autowired(PreferenceService)
  protected readonly preference: PreferenceService;

  registerMenus(menuRegistry: IMenuRegistry) {
    /** 终端 Tab 菜单 */
    menuRegistry.registerMenuItem(MenuId.TerminalTabContext, {
      command: {
        id: TERMINAL_COMMANDS.TAB_RENAME.id,
        label: localize('terminal.menu.rename'),
      },
      order: 1,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TerminalTabContext, {
      command: {
        id: TERMINAL_COMMANDS.SPLIT.id,
        label: localize('terminal.menu.split'),
      },
      order: 2,
      group,
    });

    menuRegistry.registerMenuItem(MenuId.TerminalTabContext, {
      command: {
        id: TERMINAL_COMMANDS.REMOVE.id,
        label: localize('terminal.menu.stopGroup'),
      },
      order: 3,
      group,
    });
    /** end */

    /** 终端面板右键菜单 */
    menuRegistry.registerMenuItem(CoreMenuId.TerminalInstanceContext, {
      command: TERMINAL_COMMANDS.COPY,
      group: '1_modify',
    });

    menuRegistry.registerMenuItem(CoreMenuId.TerminalInstanceContext, {
      command: TERMINAL_COMMANDS.PASTE,
      group: '1_modify',
    });

    menuRegistry.registerMenuItem(CoreMenuId.TerminalInstanceContext, {
      command: TERMINAL_COMMANDS.SELECT_ALL,
      group: '1_modify',
    });

    menuRegistry.registerMenuItem(CoreMenuId.TerminalInstanceContext, {
      command: TERMINAL_COMMANDS.CLEAR_CONTENT,
      group: '1_modify',
    });

    const location = getSlotLocation('@opensumi/ide-terminal-next', this.config.layoutConfig);
    const tabbarCtxKey = getTabbarCtxKey(location);
    const commonMenuId = getTabbarCommonMenuId(location);
    const when = `${tabbarCtxKey} == ${TERMINAL_CONTAINER_ID}`;
    /** 更多菜单 */
    menuRegistry.registerMenuItem(commonMenuId, {
      command: TERMINAL_COMMANDS.CLEAR,
      order: 1,
      group: more1,
      when,
    });

    menuRegistry.registerMenuItem(commonMenuId, {
      command: TERMINAL_COMMANDS.CLEAR_ALL_CONTENT,
      order: 1,
      group: more1,
      when,
    });

    menuRegistry.registerMenuItem(commonMenuId, {
      label: localize('terminal.menu.selectType'),
      submenu: MenuId.TerminalDefaultTypeMenu,
      order: 1,
      group: more2,
      when,
    });

    if (isWindows) {
      menuRegistry.registerMenuItems(MenuId.TerminalDefaultTypeMenu, [
        {
          command: TERMINAL_COMMANDS.SELECT_CMD,
          order: 1,
          group: more1Sub,
          toggledWhen: 'config.terminal.type == cmd',
          when,
        },
        {
          command: TERMINAL_COMMANDS.SELECT_POWERSHELL,
          order: 2,
          group: more1Sub,
          toggledWhen: 'config.terminal.type == powershell',
          when,
        },
      ]);
    } else {
      menuRegistry.registerMenuItems(MenuId.TerminalDefaultTypeMenu, [
        {
          command: TERMINAL_COMMANDS.SELECT_ZSH,
          order: 1,
          group: more1Sub,
          toggledWhen: 'config.terminal.type == zsh',
          when,
        },
        {
          command: TERMINAL_COMMANDS.SELECT_BASH,
          order: 2,
          group: more1Sub,
          toggledWhen: 'config.terminal.type == bash',
          when,
        },
        {
          command: TERMINAL_COMMANDS.SELECT_SH,
          order: 3,
          group: more1Sub,
          toggledWhen: 'config.terminal.type == sh',
          when,
        },
      ]);
    }

    menuRegistry.registerMenuItem(commonMenuId, {
      command: TERMINAL_COMMANDS.MORE_SETTINGS,
      order: 1,
      group: more2,
      when,
    });
    /** end */
  }
}
