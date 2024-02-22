import { Autowired } from '@opensumi/di';
import { Domain, localize } from '@opensumi/ide-core-common';

import { IMenuRegistry, MenuContribution } from '../menu/next/base';
import { MenuId } from '../menu/next/menu-id';
import { AppConfig } from '../react-providers/config-provider';

@Domain(MenuContribution)
export class ClientElectronCommonContribution implements MenuContribution {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  registerMenus(menus: IMenuRegistry): void {
    // 注册 Menubar
    menus.registerMenubarItem(MenuId.MenubarAppMenu, {
      label: localize('app.name', this.appConfig.appName),
      order: 0,
    });

    // Edit 菜单
    menus.registerMenuItems(MenuId.MenubarEditMenu, [
      {
        command: {
          id: 'electron.undo',
          label: localize('editor.undo'),
        },
        nativeRole: 'undo',
        group: '1_undo',
      },
      {
        command: {
          id: 'electron.redo',
          label: localize('editor.redo'),
        },
        group: '1_undo',
        nativeRole: 'redo',
      },
      {
        command: {
          label: localize('edit.cut'),
          id: 'electron.cut',
        },
        nativeRole: 'cut',
        group: '2_clipboard',
      },
      {
        command: {
          label: localize('edit.copy'),
          id: 'electron.copy',
        },
        nativeRole: 'copy',
        group: '2_clipboard',
      },
      {
        command: {
          label: localize('edit.paste'),
          id: 'electron.paste',
        },
        nativeRole: 'paste',
        group: '2_clipboard',
      },
      {
        command: {
          label: localize('edit.selectAll'),
          id: 'electron.selectAll',
        },
        nativeRole: 'selectAll',
        group: '2_clipboard',
      },
    ]);
    menus.registerMenuItems(MenuId.MenubarAppMenu, [
      {
        command: {
          id: 'electron.quit',
          label: localize('app.quit'),
        },
        nativeRole: 'quit',
        group: '4_quit',
      },
    ]);
  }
}
