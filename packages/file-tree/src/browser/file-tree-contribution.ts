import { URI, ClientAppContribution, FILE_COMMANDS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { CONTEXT_MENU } from './file-tree.view';

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

@Domain(ClientAppContribution, MenuContribution)
export class FileTreeContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.OPEN_TO_THE_SIDE.id,
      order: '4',
    });
    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.OPEN_RESOURCES.id,
      order: '3',
    });
    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.NEW_FILE.id,
      order: '2',
    });
    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.NEW_FOLDER.id,
      order: '1',
    });
    menus.registerMenuAction(FileTreeContextMenu.OPERATOR, {
      commandId: FILE_COMMANDS.DELETE_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextMenu.OPERATOR, {
      commandId: FILE_COMMANDS.RENAME_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextMenu.OPERATOR, {
      commandId: FILE_COMMANDS.COMPARE_SELECTED.id,
    });
    menus.registerMenuAction(FileTreeContextMenu.COPY, {
      commandId: FILE_COMMANDS.COPY_FILE.id,
      order: '1',
    });
    menus.registerMenuAction(FileTreeContextMenu.COPY, {
      commandId: FILE_COMMANDS.CUT_FILE.id,
      order: '2',
    });
    menus.registerMenuAction(FileTreeContextMenu.COPY, {
      commandId: FILE_COMMANDS.PASTE_FILE.id,
      order: '3',
    });
    menus.registerMenuAction(FileTreeContextMenu.PATH, {
      commandId: FILE_COMMANDS.COPY_PATH.id,
    });
    menus.registerMenuAction(FileTreeContextMenu.PATH, {
      commandId: FILE_COMMANDS.COPY_RELATIVE_PATH.id,
    });
  }
}
