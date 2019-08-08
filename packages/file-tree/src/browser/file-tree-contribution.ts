import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, localize, URI } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, FILE_COMMANDS, EDITOR_COMMANDS } from '@ali/ide-core-browser';
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

interface FileUri {
  uris: URI[];
}

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class FileTreeContribution implements CommandContribution, KeybindingContribution, MenuContribution {
  @Autowired()
  private filetreeService: FileTreeService;

  @Autowired()
  logger: Logger;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(FILE_COMMANDS.COLLAPSE_ALL, {
      execute: (uri?: URI) => {
        if (!uri) {
          uri = this.filetreeService.root;
        }
        this.filetreeService.collapseAll(uri);
      },
    });
    commands.registerCommand(FILE_COMMANDS.REFRESH_ALL, {
      execute: (uri: URI) => {
        if (!uri) {
          uri = this.filetreeService.root;
        }
        this.filetreeService.refreshAll(uri);
      },
    });
    commands.registerCommand(FILE_COMMANDS.DELETE_FILE, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            this.filetreeService.deleteFiles(uris);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length > 0;
      },
    });
    commands.registerCommand(FILE_COMMANDS.RENAME_FILE, {
      execute: (data: FileUri) => {
        // 默认使用uris中下标为0的uri作为创建基础
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            this.filetreeService.renameTempFile(uris[0]);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length > 0;
      },
    });
    commands.registerCommand(FILE_COMMANDS.NEW_FILE, {
      execute: (data?: FileUri) => {
        const selectedFile = this.filetreeService.getSelectedFileItem();

        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          this.filetreeService.createTempFile(selectedFile[0].toString());
        } else {
          if (data && data.uris) {
            const { uris } = data;
            if (uris && uris[0]) {
              this.filetreeService.createTempFile(uris[0].toString());
            }
          } else {
            this.filetreeService.createTempFile(this.filetreeService.root.toString());
          }
        }
      },
    });
    commands.registerCommand(FILE_COMMANDS.NEW_FOLDER, {
      execute: (data?: FileUri) => {
        const selectedFile = this.filetreeService.getSelectedFileItem();
        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          this.filetreeService.createTempFileFolder(selectedFile[0].toString());
        } else {
          if (data) {
            const { uris } = data;
            this.filetreeService.createTempFileFolder(uris[0].toString());
          } else {
            this.filetreeService.createTempFileFolder(this.filetreeService.root.toString());
          }
        }
      },
    });
    commands.registerCommand(FILE_COMMANDS.COMPARE_SELECTED, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            if (uris.length < 2) {
              return;
            }
            this.filetreeService.compare(uris[0], uris[1]);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 2;
      },
    });
    commands.registerCommand(FILE_COMMANDS.OPEN_RESOURCES, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          this.filetreeService.openAndFixedFile(uris[0]);
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 1 && !this.filetreeService.focusedFiles[0].filestat.isDirectory;
      },
    });
  }

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

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: FILE_COMMANDS.COLLAPSE_ALL.id,
      keybinding: 'cmd+shift+z',
      context: FileTreeKeybindingContexts.fileTreeItemFocus,
    });

    // keybindings.registerKeybinding({
    //   command: FILE_COMMANDS.RENAME_FILE.id,
    //   keybinding: 'enter',
    //   context: FileTreeKeybindingContexts.fileTreeItemFocus,
    //   args: [],
    // });
  }
}
