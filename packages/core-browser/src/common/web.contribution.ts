import { Domain } from '@opensumi/ide-core-common';

import { IMenuRegistry, MenuContribution } from '../menu/next/base';
import { MenuId } from '../menu/next/menu-id';

import { COMMON_COMMANDS, EDITOR_COMMANDS } from './common.command';

@Domain(MenuContribution)
export class ClientWebCommonContribution implements MenuContribution {
  registerMenus(menus: IMenuRegistry): void {
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
