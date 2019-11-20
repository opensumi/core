import { URI, ClientAppContribution, FILE_COMMANDS, CommandRegistry, KeybindingRegistry, TabBarToolbarRegistry, CommandContribution, KeybindingContribution, TabBarToolbarContribution, localize, isElectronRenderer, IElectronNativeDialogService, ILogger } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { CONTEXT_MENU } from './file-tree.view';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { FileTreeService } from './file-tree.service';
import { IDecorationsService } from '@ali/ide-decoration';
import { SymlinkDecorationsProvider } from './symlink-file-decoration';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { ExplorerResourcePanel } from './resource-panel.view';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { ExplorerResourceService } from './explorer-resource.service';
import { WorkbenchEditorService } from '@ali/ide-editor';
import * as copy from 'copy-to-clipboard';
import { KAITIAN_MUTI_WORKSPACE_EXT, IWorkspaceService } from '@ali/ide-workspace';
import { NextMenuContribution, IMenuRegistry, MenuId, ExplorerContextCallback } from '@ali/ide-core-browser/lib/menu/next';
import { IWindowService } from '@ali/ide-window';

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

export const ExplorerResourceViewId = 'file-explorer';

@Domain(NextMenuContribution, CommandContribution, KeybindingContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution)
export class FileTreeContribution implements NextMenuContribution, CommandContribution, KeybindingContribution, TabBarToolbarContribution, ClientAppContribution, MainLayoutContribution {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(FileTreeService)
  private filetreeService: FileTreeService;

  @Autowired(ExplorerResourceService)
  private explorerResourceService: ExplorerResourceService;

  @Autowired(IDecorationsService)
  private decorationsService: IDecorationsService;

  @Autowired(IMainLayoutService)
  private mainLayoutService: IMainLayoutService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  private editorService: WorkbenchEditorService;

  @Autowired(ILogger)
  private logger;

  onStart() {
    const workspace = this.workspaceService.workspace;
    let resourceTitle = localize('file.empty.defaultTitle');
    if (workspace) {
      const uri = new URI(workspace.uri);
      resourceTitle = uri.displayName;
      if (!workspace.isDirectory &&
        (resourceTitle.endsWith(`.${KAITIAN_MUTI_WORKSPACE_EXT}`))) {
        resourceTitle = resourceTitle.slice(0, resourceTitle.lastIndexOf('.'));
      }
    }
    this.mainLayoutService.collectViewComponent({
      id: ExplorerResourceViewId,
      name: resourceTitle,
      weight: 3,
      priority: 8,
      collapsed: true,
      component: ExplorerResourcePanel,
    }, ExplorerContainerId);
  }

  onDidStart() {
    const symlinkDecorationsProvider = this.injector.get(SymlinkDecorationsProvider, [this.explorerResourceService]);
    this.decorationsService.registerDecorationsProvider(symlinkDecorationsProvider);
  }

  registerNextMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.OPEN_RESOURCES.id,
      order: 4,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.OPEN_TO_THE_SIDE.id,
      order: 3,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.NEW_FILE.id,
      order: 1,
      group: '1_open',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.NEW_FOLDER.id,
      order: 2,
      group: '1_open',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.DELETE_FILE.id,
      order: 1,
      group: '2_operator',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.RENAME_FILE.id,
      order: 3,
      group: '2_operator',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COMPARE_SELECTED.id,
      order: 2,
      group: '2_operator',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COPY_FILE.id,
      order: 1,
      group: '3_copy',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.CUT_FILE.id,
      order: 2,
      group: '3_copy',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.PASTE_FILE.id,
      order: 3,
      group: '3_copy',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COPY_PATH.id,
      group: '4_path',
    });
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: FILE_COMMANDS.COPY_RELATIVE_PATH.id,
      group: '4_path',
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(FILE_COMMANDS.LOCATION, {
      execute: (uri?: URI) => {
        let locationUri = uri;

        if (!locationUri) {
          locationUri = this.filetreeService.selectedUris[0];
        }
        if (locationUri) {
          const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
          if (!handler || !handler.isVisible || handler.isCollapsed(ExplorerResourceViewId)) {
            this.explorerResourceService.locationOnShow(locationUri);
          } else {
            this.explorerResourceService.location(locationUri);
          }
        }
      },
    });
    commands.registerCommand(FILE_COMMANDS.COLLAPSE_ALL, {
      execute: () => {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible) {
          return;
        }
        this.filetreeService.collapseAll();
      },
    });
    commands.registerCommand(FILE_COMMANDS.REFRESH_ALL, {
      execute: async () => {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible) {
          return;
        }
        await this.filetreeService.refresh(this.filetreeService.root);
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.DELETE_FILE, {
      execute: (_, uris) => {
        this.logger.verbose('delete');
        if (uris && uris.length) {
          this.filetreeService.deleteFiles(uris);
        } else {
          const seletedUris = this.filetreeService.selectedUris;
          if (seletedUris && seletedUris.length) {
            this.filetreeService.deleteFiles(seletedUris);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedUris.length > 0;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.RENAME_FILE, {
      execute: (_, uris) => {
        // 默认使用uris中下标为0的uri作为创建基础
        if (uris && uris.length) {
          this.filetreeService.renameTempFile(uris[0]);
        } else {
          const selectedFiles = this.filetreeService.selectedFiles;
          if (selectedFiles && selectedFiles.length) {
            const selected = selectedFiles[0];
            if (!selected.isTemporary) {
              this.filetreeService.renameTempFile(selectedFiles[0].uri);
            }
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedUris.length > 0;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.NEW_FILE, {
      execute: async (uri) => {
        // 默认获取焦点元素
        const selectedFile = this.filetreeService.focusedUris;
        let fromUri: URI;
        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          fromUri = selectedFile[0];
        } else {
          if (uri) {
            fromUri = uri;
          } else {
            fromUri = this.filetreeService.root;
          }
        }
        const tempFileUri = await this.filetreeService.createTempFile(fromUri);
        if (tempFileUri) {
          await this.explorerResourceService.location(tempFileUri, true);
        }

      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.NEW_FOLDER, {
      execute: async (uri) => {
        const selectedFile = this.filetreeService.focusedUris;
        let fromUri: URI;
        // 只处理单选情况下的创建
        if (selectedFile.length === 1) {
          fromUri = selectedFile[0];
        } else {
          if (uri) {
            fromUri = uri;
          } else {
            fromUri = this.filetreeService.root;
          }
        }
        const tempFileUri = await this.filetreeService.createTempFolder(fromUri);
        if (tempFileUri) {
          await this.explorerResourceService.location(tempFileUri);
        }
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COMPARE_SELECTED, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          const currentEditor = this.editorService.currentEditor;
          if (currentEditor && currentEditor.currentUri) {
            this.filetreeService.compare(uris[0], currentEditor.currentUri);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 1 && !this.filetreeService.focusedFiles[0].filestat.isDirectory;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.OPEN_RESOURCES, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          this.filetreeService.openAndFixedFile(uris[0]);
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 1 && !this.filetreeService.focusedFiles[0].filestat.isDirectory;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.OPEN_TO_THE_SIDE, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          this.filetreeService.openToTheSide(uris[0]);
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length === 1 && !this.filetreeService.focusedFiles[0].filestat.isDirectory;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COPY_PATH, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          const copyUri: URI = uris[0];
          copy(decodeURIComponent(copyUri.withScheme('').toString()));
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedUris.length === 1;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COPY_RELATIVE_PATH, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          const copyUri: URI = uris[0];
          if (this.filetreeService.root) {
            copy(decodeURIComponent(this.filetreeService.root.relative(copyUri)!.toString()));
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedUris.length === 1;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COPY_FILE, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          this.filetreeService.copyFile(uris);
        } else {
          const seletedUris = this.filetreeService.selectedUris;
          if (seletedUris && seletedUris.length) {
            this.filetreeService.cutFile(seletedUris);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length >= 1;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.CUT_FILE, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          this.filetreeService.cutFile(uris);
        } else {
          const seletedUris = this.filetreeService.selectedUris;
          if (seletedUris && seletedUris.length) {
            this.filetreeService.cutFile(seletedUris);
          }
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length >= 1;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.PASTE_FILE, {
      execute: (_, uris) => {
        if (uris && uris.length > 0) {
          const pasteUri: URI = uris[0];
          this.filetreeService.pasteFile(pasteUri);
        } else if (this.filetreeService.selectedFiles.length > 0) {
          const selectedFiles = this.filetreeService.selectedFiles;
          const to = selectedFiles[0];
          if (to.filestat.isDirectory) {
            this.filetreeService.pasteFile(to.uri);
          } else {
            this.filetreeService.pasteFile(to.uri.parent);
          }
        } else {
          this.filetreeService.pasteFile(this.filetreeService.root);
        }
      },
      isVisible: () => {
        return (this.filetreeService.focusedFiles.length === 1 && this.filetreeService.focusedFiles[0].filestat.isDirectory) || this.filetreeService.focusedFiles.length === 0;
      },
      isEnabled: () => {
        return this.filetreeService.hasPasteFile;
      },
    });
    commands.registerCommand(FILE_COMMANDS.OPEN_FOLDER, {
      execute: (options: {newWindow: boolean}) => {
        const dialogService: IElectronNativeDialogService = this.injector.get(IElectronNativeDialogService);
        const windowService: IWindowService = this.injector.get(IWindowService);
        dialogService.showOpenDialog({
            title: localize('workspace.open-directory'),
            properties: [
              'openDirectory',
            ],
          }).then((paths) => {
            if (paths && paths.length > 0) {
              windowService.openWorkspace(URI.file(paths[0]), options || {newWindow: true});
            }
          });
      },
      isEnabled: () => {
        return isElectronRenderer();
      },
    });

  }

  registerKeybindings(bindings: KeybindingRegistry) {
    bindings.registerKeybinding({
      command: FILE_COMMANDS.LOCATION.id,
      keybinding: 'cmd+shift+e',
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.COPY_FILE.id,
      keybinding: 'ctrlcmd+c',
      when: 'filesExplorerFocus',
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.PASTE_FILE.id,
      keybinding: 'ctrlcmd+v',
      when: 'filesExplorerFocus',
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.CUT_FILE.id,
      keybinding: 'ctrlcmd+x',
      when: 'filesExplorerFocus',
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.RENAME_FILE.id,
      keybinding: 'enter',
      when: 'filesExplorerFocus && !inputFocus',
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.DELETE_FILE.id,
      keybinding: 'ctrlcmd+backspace',
      when: 'filesExplorerFocus',
    });
  }

  registerToolbarItems(registry: TabBarToolbarRegistry) {
    registry.registerItem({
      id: FILE_COMMANDS.COLLAPSE_ALL.id,
      command: FILE_COMMANDS.COLLAPSE_ALL.id,
      viewId: ExplorerResourceViewId,
    });
    registry.registerItem({
      id: FILE_COMMANDS.REFRESH_ALL.id,
      command: FILE_COMMANDS.REFRESH_ALL.id,
      viewId: ExplorerResourceViewId,
    });
    registry.registerItem({
      id: FILE_COMMANDS.NEW_FOLDER.id,
      command: FILE_COMMANDS.NEW_FOLDER.id,
      viewId: ExplorerResourceViewId,
    });
    registry.registerItem({
      id: FILE_COMMANDS.NEW_FILE.id,
      command: FILE_COMMANDS.NEW_FILE.id,
      viewId: ExplorerResourceViewId,
    });
  }

  onDidUseConfig() {
    const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
    if (handler) {
      handler.onActivate(() => {
        this.explorerResourceService.performLocationOnHandleShow();
      });
    }
  }
}
