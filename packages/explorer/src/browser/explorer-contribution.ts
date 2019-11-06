import { Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { CommandContribution, CommandRegistry, ClientAppContribution, EXPLORER_COMMANDS, URI, Domain, KeybindingContribution, KeybindingRegistry, FILE_COMMANDS, localize } from '@ali/ide-core-browser';
import { ExplorerResourceService } from './explorer-resource.service';
import { FileTreeService, FileUri } from '@ali/ide-file-tree';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ExplorerResourcePanel } from './resource-panel.view';
import { IWorkspaceService, KAITIAN_MUTI_WORKSPACE_EXT } from '@ali/ide-workspace';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-core-browser/lib/layout';
import { IDecorationsService } from '@ali/ide-decoration';
import { SymlinkDecorationsProvider } from './symlink-file-decoration';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import * as copy from 'copy-to-clipboard';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ExplorerContextCallback } from '@ali/ide-core-browser/lib/menu/next';

export const ExplorerResourceViewId = 'file-explorer';
export const ExplorerContainerId = 'explorer';

@Domain(ClientAppContribution, CommandContribution, ComponentContribution, KeybindingContribution, TabBarToolbarContribution, ClientAppContribution)
export class ExplorerContribution implements CommandContribution, ComponentContribution, KeybindingContribution, TabBarToolbarContribution, ClientAppContribution {

  @Autowired()
  private explorerResourceService: ExplorerResourceService;

  @Autowired()
  private filetreeService: FileTreeService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(IDecorationsService)
  private decorationsService: IDecorationsService;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  onDidStart() {
    const symlinkDecorationsProvider = this.injector.get(SymlinkDecorationsProvider, [this.explorerResourceService]);
    this.decorationsService.registerDecorationsProvider(symlinkDecorationsProvider);
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(EXPLORER_COMMANDS.LOCATION, {
      execute: (uri?: URI) => {
        const handler = this.mainlayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible || handler.isCollapsed(ExplorerResourceViewId)) {
          return;
        }
        let locationUri = uri;

        if (!locationUri) {
          locationUri = this.filetreeService.selectedUris[0];
        }
        if (locationUri) {
          this.explorerResourceService.location(locationUri);
        }
      },
    });
    commands.registerCommand(FILE_COMMANDS.COLLAPSE_ALL, {
      execute: (uri?: URI) => {
        const handler = this.mainlayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible) {
          return;
        }
        if (!uri) {
          uri = this.filetreeService.root;
        }
        this.filetreeService.collapseAll(uri);
      },
    });
    commands.registerCommand(FILE_COMMANDS.REFRESH_ALL, {
      execute: async () => {
        const handler = this.mainlayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible) {
          return;
        }
        await this.filetreeService.refresh(this.filetreeService.root);
      },
    });

    // 注册给ExplorerMenu的Command执行参数为 ExplorerContextParams
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.DELETE_FILE, {
      execute: async (_, uris) => {
        if (uris && uris.length) {
          this.filetreeService.deleteFiles(uris);
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedUris.length > 0;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.RENAME_FILE, {
      execute: async (_, uris) => {
        // 默认使用uris中下标为0的uri作为创建基础
        if (uris && uris.length) {
          this.filetreeService.renameTempFile(uris[0]);
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
          copy(copyUri.withScheme('').toString());
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
            copy(this.filetreeService.root.relative(copyUri)!.toString());
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
        }
      },
      isVisible: () => {
        return this.filetreeService.focusedFiles.length >= 1;
      },
    });
    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.PASTE_FILE, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          const pasteUri: URI = uris[0];
          this.filetreeService.pasteFile(pasteUri);
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
  }

  registerKeybindings(bindings: KeybindingRegistry) {
    bindings.registerKeybinding({
      command: EXPLORER_COMMANDS.LOCATION.id,
      keybinding: 'cmd+shift+e',
    });
  }

  registerComponent(registry: ComponentRegistry) {
    const workspace = this.workspaceService.workspace;
    let resourceTitle = 'UNDEFINE';
    if (workspace) {
      const uri = new URI(workspace.uri);
      resourceTitle = uri.displayName;
      if (!workspace.isDirectory &&
        (resourceTitle.endsWith(`.${KAITIAN_MUTI_WORKSPACE_EXT}`))) {
        resourceTitle = resourceTitle.slice(0, resourceTitle.lastIndexOf('.'));
      }
    }
    registry.register('@ali/ide-explorer', [
      {
        component: ExplorerResourcePanel,
        id: ExplorerResourceViewId,
        name: resourceTitle,
        weight: 3,
      },
    ], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: ExplorerContainerId,
      activateKeyBinding: 'shift+ctrlcmd+e',
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
}
