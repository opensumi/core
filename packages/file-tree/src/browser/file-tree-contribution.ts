import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, localize, URI } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { ActivatorBarService } from '@ali/ide-activator-bar/lib/browser/activator-bar.service';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';
import { CONTEXT_SINGLE_MENU, CONTEXT_MULTI_MENU, CONTEXT_FOLDER_MENU } from './file-tree.view';
import { FileTreeService } from './file-tree.service';
import { FileTreeKeybindingContexts } from './file-tree-keybinding-contexts';

export const FILETREE_BROWSER_COMMANDS: {
  [key: string]: Command,
} = {
  DELETE_FILE: {
    id: 'filetree.delete.file',
  },
  RENAME_FILE: {
    id: 'filetree.rename.file',
  },
  NEW_FILE: {
    id: 'filetree.new.file',
    label: localize('new.file', '新建文件'),
  },
  NEW_FOLDER: {
    id: 'filetree.new.filefolder',
    label: localize('new.file.folder', '新建文件夹'),
  },
  COMPARE_SELECTED: {
    id: 'filetree.compareSelected',
  },
  COLLAPSE_ALL: {
    id: 'filetree.collapse.all',
  },
  REFRESH_ALL: {
    id: 'filetree.refresh.all',
  },
};

export namespace FileTreeContextSingleMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = [...CONTEXT_SINGLE_MENU, '1_open'];
  export const OPERATOR = [...CONTEXT_SINGLE_MENU, '2_operator'];
}

export namespace FileTreeContextMutiMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = [...CONTEXT_MULTI_MENU, '1_open'];
  export const OPERATOR = [...CONTEXT_MULTI_MENU, '2_operator'];
}

export namespace FileTreeContextFolderMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = [...CONTEXT_FOLDER_MENU, '1_open'];
  export const OPERATOR = [...CONTEXT_FOLDER_MENU, '2_operator'];
}

interface FileUri {
  uris: URI[];
}

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class FileTreeContribution implements CommandContribution, KeybindingContribution, MenuContribution {

  @Autowired()
  private activatorBarService: ActivatorBarService;

  @Autowired()
  private filetreeService: FileTreeService;

  @Autowired()
  logger: Logger;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.COLLAPSE_ALL, {
      execute: (uri: URI) => {
        this.filetreeService.collapseAll(uri);
      },
    });
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.REFRESH_ALL, {
      execute: (uri: URI) => {
        this.filetreeService.refreshAll(uri);
      },
    });
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.COLLAPSE_ALL, {
      execute: (uri: URI) => {
        this.filetreeService.collapseAll(uri);
      },
    });
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.DELETE_FILE, {
      execute: (data: FileUri) => {
        if (data) {
          const { uris } = data;
          if (uris && uris.length) {
            this.filetreeService.deleteFiles(uris);
          }
        }
      },
    });
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.RENAME_FILE, {
      execute: (data: FileUri) => {
        // 默认使用uris中下标为0的uri作为创建基础
        if (data) {
          const { uris } = data;
          this.logger.log('Rename File', uris);
          if (uris && uris.length) {
            this.filetreeService.renameTempFile(uris[0]);
          }
        }
      },
    });
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.NEW_FILE, {
      execute: (data: FileUri) => {
        const selectedFile = this.filetreeService.getSelectedFileItem();
        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          this.filetreeService.createTempFile(selectedFile[0].toString());
        } else {
          if (data) {
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
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.NEW_FOLDER, {
      execute: (data: FileUri) => {
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
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.COMPARE_SELECTED, {
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
    });
    commands.registerCommand(FILETREE_BROWSER_COMMANDS.COMPARE_SELECTED, {
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
      });
  }

  registerMenus(menus: MenuModelRegistry): void {

    // 单选菜单
    menus.registerMenuAction(FileTreeContextSingleMenu.OPEN, {
      label: localize('filetree.newfile', '新建文件'),
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextSingleMenu.OPEN, {
      label: localize('filetree.newfolder', '新建文件夹'),
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FOLDER.id,
    });
    menus.registerMenuAction(FileTreeContextSingleMenu.OPEN, {
      label: localize('filetree.openfile', '打开文件'),
      commandId: EDITOR_BROWSER_COMMANDS.openResources,
    });
    menus.registerMenuAction(FileTreeContextSingleMenu.OPERATOR, {
      label: localize('filetree.deletefile', '删除文件'),
      commandId: FILETREE_BROWSER_COMMANDS.DELETE_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextSingleMenu.OPERATOR, {
      label: localize('filetree.renamefile', '重命名'),
      commandId: FILETREE_BROWSER_COMMANDS.RENAME_FILE.id,
    });

    // 多选菜单，移除部分选项
    menus.registerMenuAction(FileTreeContextMutiMenu.OPEN, {
      label: localize('filetree.newfile', '新建文件'),
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextMutiMenu.OPEN, {
      label: localize('filetree.newfolder', '新建文件夹'),
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FOLDER.id,
    });
    menus.registerMenuAction(FileTreeContextMutiMenu.OPERATOR, {
      label: localize('filetree.deletefile', '删除文件'),
      commandId: FILETREE_BROWSER_COMMANDS.DELETE_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextMutiMenu.OPERATOR, {
      label: localize('Compare selected File', '比较选中的文件'),
      commandId: FILETREE_BROWSER_COMMANDS.COMPARE_SELECTED.id,
    });

    // 文件夹菜单
    menus.registerMenuAction(FileTreeContextFolderMenu.OPEN, {
      label: localize('filetree.newfile', '新建文件'),
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextFolderMenu.OPEN, {
      label: localize('filetree.newfolder', '新建文件夹'),
      commandId: FILETREE_BROWSER_COMMANDS.NEW_FOLDER.id,
    });
    menus.registerMenuAction(FileTreeContextFolderMenu.OPERATOR, {
      label: localize('filetree.deletefolder', '删除文件夹'),
      commandId: FILETREE_BROWSER_COMMANDS.DELETE_FILE.id,
    });
    menus.registerMenuAction(FileTreeContextFolderMenu.OPERATOR, {
      label: localize('filetree.rename', '重命名'),
      commandId: FILETREE_BROWSER_COMMANDS.RENAME_FILE.id,
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: FILETREE_BROWSER_COMMANDS.COLLAPSE_ALL.id,
      keybinding: 'cmd+shift+z',
      context: FileTreeKeybindingContexts.fileTreeItemFocus,
    });

    // keybindings.registerKeybinding({
    //   command: FILETREE_BROWSER_COMMANDS.RENAME_FILE.id,
    //   keybinding: 'enter',
    //   context: FileTreeKeybindingContexts.fileTreeItemFocus,
    //   args: [],
    // });
  }

}
