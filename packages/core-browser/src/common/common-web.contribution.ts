import { Autowired } from '@opensumi/di';
import { CommandService, Domain } from '@opensumi/ide-core-common';

import { MenuContribution, IMenuRegistry } from '../menu/next/base';
import { MenuId } from '../menu/next/menu-id';
import { AppConfig } from '../react-providers/config-provider';

import { COMMON_COMMANDS, EDITOR_COMMANDS } from './common.command';

@Domain(MenuContribution)
export class ClientWebCommonContribution implements MenuContribution {
  @Autowired(CommandService)
  protected commandService: CommandService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  registerMenus(menus: IMenuRegistry): void {
    if (!this.appConfig.isElectronRenderer) {
      // Edit 菜单
      menus.registerMenuItems(MenuId.MenubarEditMenu, [
        {
          command: EDITOR_COMMANDS.REDO.id,
          group: '1_undo',
        },
        {
          command: EDITOR_COMMANDS.UNDO.id,
          group: '1_undo',
        },
      ]);
      // 帮助菜单
      menus.registerMenuItem(MenuId.MenubarHelpMenu, {
        command: {
          id: COMMON_COMMANDS.ABOUT_COMMAND.id,
          label: COMMON_COMMANDS.ABOUT_COMMAND.label!,
        },
        nativeRole: 'about',
        group: '0_about',
      });
    }
  }
}
