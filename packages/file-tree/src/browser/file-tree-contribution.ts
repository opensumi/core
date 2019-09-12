import { Autowired } from '@ali/common-di';
import { URI, KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, FILE_COMMANDS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { CONTEXT_MENU } from './file-tree.view';
import { FileTreeService } from './file-tree.service';
import { FileTreeKeybindingContexts } from './file-tree-keybinding-contexts';

export namespace FileTreeContextMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = [...CONTEXT_MENU, '1_open'];
  export const OPERATOR = [...CONTEXT_MENU, '2_operator'];
}

export interface FileUri {
  uris: URI[];
}

@Domain(ClientAppContribution, MenuContribution)
export class FileTreeContribution implements MenuContribution {
  @Autowired()
  private filetreeService: FileTreeService;

  @Autowired()
  logger: Logger;

  registerMenus(menus: MenuModelRegistry): void {

    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.NEW_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.NEW_FOLDER.id,
    });
    menus.registerMenuAction(FileTreeContextMenu.OPEN, {
      commandId: FILE_COMMANDS.OPEN_RESOURCES.id,
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
  }
}
