import { URI, ClientAppContribution, FILE_COMMANDS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { CONTEXT_MENU } from './file-tree.view';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

export namespace FileTreeContextMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = [...CONTEXT_MENU, '1_open'];
  export const OPERATOR = [...CONTEXT_MENU, '2_operator'];
  export const COPY = [...CONTEXT_MENU, '3_copy'];
  export const PATH = [...CONTEXT_MENU, '4_path'];
}

export interface FileUri {
  uris: URI[];
}

@Domain(ClientAppContribution, NextMenuContribution)
export class FileTreeContribution implements NextMenuContribution {
  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.OPEN_RESOURCES,
      order: 1,
      group: '1_open',
    });

    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.OPEN_TO_THE_SIDE,
      order: 2,
      group: '1_open',
    });

    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.NEW_FILE,
      order: 4,
      group: '1_open',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.NEW_FOLDER,
      order: 3,
      group: '1_open',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.DELETE_FILE,
      order: 1,
      group: '2_operator',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.RENAME_FILE,
      order: 3,
      group: '2_operator',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COMPARE_SELECTED,
      order: 2,
      group: '2_operator',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COPY_FILE,
      order: 1,
      group: '3_copy',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.CUT_FILE,
      order: 2,
      group: '3_copy',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.PASTE_FILE,
      order: 3,
      group: '3_copy',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COPY_PATH,
      group: '4_path',
    });
    menuRegistry.appendMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COPY_RELATIVE_PATH,
      group: '4_path',
    });
  }
}
