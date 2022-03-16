import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  IApplicationService,
  URI,
  ClientAppContribution,
  localize,
  CommandContribution,
  KeybindingContribution,
  TabBarToolbarContribution,
  FILE_COMMANDS,
  CommandRegistry,
  CommandService,
  SEARCH_COMMANDS,
  IElectronNativeDialogService,
  ToolbarRegistry,
  KeybindingRegistry,
  IWindowService,
  IClipboardService,
  PreferenceService,
  formatLocalize,
  OS,
  WORKSPACE_COMMANDS,
  AppConfig,
} from '@opensumi/ide-core-browser';
import { FilesExplorerFilteredContext } from '@opensumi/ide-core-browser/lib/contextkey/explorer';
import {
  FilesExplorerFocusedContext,
  FilesExplorerInputFocusedContext,
} from '@opensumi/ide-core-browser/lib/contextkey/explorer';
import {
  MenuContribution,
  IMenuRegistry,
  MenuId,
  ExplorerContextCallback,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ExplorerContainerId } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';
import { IMainLayoutService, IViewsRegistry, MainLayoutContribution } from '@opensumi/ide-main-layout';
import { ViewContentGroups } from '@opensumi/ide-main-layout/lib/browser/views-registry';
import { IOpenDialogOptions, IWindowDialogService, ISaveDialogOptions } from '@opensumi/ide-overlay';
import { TERMINAL_COMMANDS } from '@opensumi/ide-terminal-next';
import { DEFAULT_WORKSPACE_SUFFIX_NAME, IWorkspaceService, UNTITLED_WORKSPACE } from '@opensumi/ide-workspace';

import { IFileTreeService, PasteTypes } from '../common';
import { Directory } from '../common/file-tree-node.define';

import { FileTree } from './file-tree';
import { FileTreeService } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';
import { SymlinkDecorationsProvider } from './symlink-file-decoration';


export const ExplorerResourceViewId = 'file-explorer-next';

@Domain(
  MenuContribution,
  CommandContribution,
  KeybindingContribution,
  TabBarToolbarContribution,
  ClientAppContribution,
  MainLayoutContribution,
)
export class FileTreeContribution
  implements
    MenuContribution,
    CommandContribution,
    KeybindingContribution,
    TabBarToolbarContribution,
    ClientAppContribution,
    MainLayoutContribution
{
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IFileTreeService)
  private readonly fileTreeService: FileTreeService;

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(FileTreeModelService)
  private readonly fileTreeModelService: FileTreeModelService;

  @Autowired(IDecorationsService)
  public readonly decorationService: IDecorationsService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IWindowDialogService)
  private readonly windowDialogService: IWindowDialogService;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IViewsRegistry)
  private viewsRegistry: IViewsRegistry;

  @Autowired(IApplicationService)
  private readonly appService: IApplicationService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  private isRendered = false;

  get workspaceSuffixName() {
    return this.appConfig.workspaceSuffixName || DEFAULT_WORKSPACE_SUFFIX_NAME;
  }

  initialize() {
    // 等待排除配置初始化结束后再初始化文件树
    this.workspaceService.initFileServiceExclude().then(() => {
      this.fileTreeModelService.initTreeModel();
    });
  }

  async onStart() {
    this.viewsRegistry.registerViewWelcomeContent(ExplorerResourceViewId, {
      content: formatLocalize('welcome-view.noFolderHelp', FILE_COMMANDS.OPEN_FOLDER.id),
      group: ViewContentGroups.Open,
      order: 1,
    });
    await this.fileTreeService.init();
    this.mainLayoutService.collectViewComponent(
      {
        id: ExplorerResourceViewId,
        name: this.getWorkspaceTitle(),
        weight: 3,
        priority: 9,
        collapsed: false,
        component: FileTree,
      },
      ExplorerContainerId,
    );
    // 监听工作区变化更新标题
    this.workspaceService.onWorkspaceLocationChanged(() => {
      const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
      if (handler) {
        handler.updateViewTitle(ExplorerResourceViewId, this.getWorkspaceTitle());
      }
    });
  }

  onDidStart() {
    const symlinkDecorationsProvider = this.injector.get(SymlinkDecorationsProvider, [this.fileTreeService]);
    this.decorationService.registerDecorationsProvider(symlinkDecorationsProvider);
  }

  onDidRender() {
    this.isRendered = true;
    const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
    if (handler) {
      handler.onActivate(() => {
        this.fileTreeModelService.contextKey.explorerViewletVisibleContext.set(true);
        this.fileTreeModelService.performLocationOnHandleShow();
      });
      handler.onInActivate(() => {
        this.fileTreeModelService.contextKey.explorerViewletVisibleContext.set(false);
      });
    }
  }

  getWorkspaceTitle() {
    let resourceTitle = localize('file.empty.defaultTitle');
    const workspace = this.workspaceService.workspace;
    if (workspace) {
      const uri = new URI(workspace.uri);
      resourceTitle = uri.displayName;
      if (!workspace.isDirectory && resourceTitle.endsWith(`.${this.workspaceSuffixName}`)) {
        resourceTitle = resourceTitle.slice(0, resourceTitle.lastIndexOf('.'));
        if (resourceTitle === UNTITLED_WORKSPACE) {
          return localize('file.workspace.defaultTip');
        }
      }
    }
    return resourceTitle;
  }

  onReconnect() {
    this.fileTreeService.reWatch();
  }

  private revealFile(locationUri: URI) {
    if (locationUri) {
      if (this.isRendered) {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible || handler.isCollapsed(ExplorerResourceViewId)) {
          this.fileTreeModelService.locationOnShow(locationUri);
        } else {
          this.fileTreeModelService.location(locationUri);
        }
      } else {
        this.fileTreeModelService.locationOnShow(locationUri);
      }
    }
  }

  registerMenus(menuRegistry: IMenuRegistry): void {
    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.NEW_FILE.id,
        label: localize('file.new'),
      },
      order: 1,
      group: '0_new',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.NEW_FOLDER.id,
        label: localize('file.folder.new'),
      },
      order: 2,
      group: '0_new',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.OPEN_RESOURCES.id,
        label: localize('file.open'),
      },
      order: 1,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.OPEN_TO_THE_SIDE.id,
        label: localize('file.open.side'),
      },
      order: 2,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.OPEN_WITH_PATH.id,
        label: localize('file.filetree.openWithPath'),
      },
      when: 'workbench.panel.terminal',
      order: 3,
      group: '1_open',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.SEARCH_ON_FOLDER.id,
        label: localize('file.search.folder'),
      },
      order: 1,
      group: '2_search',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.DELETE_FILE.id,
        label: localize('file.delete'),
      },
      order: 1,
      group: '2_operator',
      when: FilesExplorerFilteredContext.not,
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.RENAME_FILE.id,
        label: localize('file.rename'),
      },
      order: 3,
      group: '2_operator',
      when: FilesExplorerFilteredContext.not,
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.COMPARE_SELECTED.id,
        label: localize('file.compare'),
      },
      order: 2,
      group: '2_operator',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.COPY_FILE.id,
        label: localize('file.copy.file'),
      },
      order: 1,
      group: '3_copy',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.CUT_FILE.id,
        label: localize('file.cut.file'),
      },
      order: 2,
      group: '3_copy',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.PASTE_FILE.id,
        label: localize('file.paste.file'),
      },
      order: 3,
      group: '3_copy',
      when: FilesExplorerFilteredContext.not,
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.COPY_PATH.id,
        label: localize('file.copy.path'),
      },
      group: '4_path',
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: {
        id: FILE_COMMANDS.COPY_RELATIVE_PATH.id,
        label: localize('file.copy.relativepath'),
      },
      group: '4_path',
    });
  }

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(FILE_COMMANDS.OPEN_WITH_PATH, {
      execute: (uri?: URI) => {
        let directory = uri;

        if (!directory) {
          return;
        }
        const file = this.fileTreeService.getNodeByPathOrUri(directory);
        if (file && !file.filestat.isDirectory) {
          directory = file.uri.parent;
        }
        this.commandService.executeCommand(TERMINAL_COMMANDS.OPEN_WITH_PATH.id, directory);
      },
    });
    commands.registerCommand(FILE_COMMANDS.SEARCH_ON_FOLDER, {
      execute: async (uri?: URI) => {
        let searchFolder = uri;

        if (!searchFolder) {
          if (this.fileTreeModelService.focusedFile) {
            searchFolder = this.fileTreeModelService.focusedFile.uri;
          } else if (this.fileTreeModelService.selectedFiles.length > 0) {
            searchFolder = this.fileTreeModelService.selectedFiles[0]?.uri;
          }
        }
        if (!searchFolder) {
          return;
        }
        let searchPath: string;
        if (this.fileTreeService.isMultipleWorkspace) {
          // 多工作区额外处理
          for (const root of await this.workspaceService.roots) {
            const rootUri = new URI(root.uri);
            if (rootUri.isEqualOrParent(searchFolder)) {
              searchPath = `./${rootUri.relative(searchFolder)!.toString()}`;
              break;
            }
          }
        } else {
          if (this.workspaceService.workspace) {
            const rootUri = new URI(this.workspaceService.workspace.uri);
            if (rootUri.isEqualOrParent(searchFolder)) {
              searchPath = `./${rootUri.relative(searchFolder)!.toString()}`;
            }
          }
        }
        this.commandService.executeCommand(SEARCH_COMMANDS.OPEN_SEARCH.id, { includeValue: searchPath! });
      },
      isVisible: () =>
        !!this.fileTreeModelService.contextMenuFile && Directory.is(this.fileTreeModelService.contextMenuFile),
    });

    commands.registerCommand(FILE_COMMANDS.LOCATION, {
      execute: (locationUri?: URI) => {
        if (locationUri) {
          this.revealFile(locationUri);
        } else if (this.fileTreeModelService.selectedFiles && this.fileTreeModelService.selectedFiles.length > 0) {
          this.revealFile(this.fileTreeModelService.selectedFiles[0].uri);
        }
      },
    });

    commands.registerCommand(FILE_COMMANDS.LOCATION_WITH_EDITOR, {
      execute: () => {
        if (this.workbenchEditorService.currentEditor?.currentUri?.scheme === 'file') {
          this.revealFile(this.workbenchEditorService.currentEditor?.currentUri);
        }
      },
    });

    commands.registerCommand(FILE_COMMANDS.COLLAPSE_ALL, {
      execute: () => {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible) {
          return;
        }
        this.fileTreeModelService.collapseAll();
      },
    });

    commands.registerCommand(FILE_COMMANDS.REFRESH_ALL, {
      execute: async () => {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (!handler || !handler.isVisible) {
          return;
        }
        await this.fileTreeService.refresh();
      },
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.DELETE_FILE, {
      execute: (_, uris) => {
        if (!uris) {
          if (this.fileTreeModelService.selectedFiles && this.fileTreeModelService.selectedFiles.length > 0) {
            uris = this.fileTreeModelService.selectedFiles.map((file) => file.uri);
          } else {
            return;
          }
        }
        this.fileTreeModelService.deleteFileByUris(uris);
      },
      isVisible: () =>
        !!this.fileTreeModelService.contextMenuFile &&
        !this.fileTreeModelService.contextMenuFile.uri.isEqual(
          (this.fileTreeModelService.treeModel.root as Directory).uri,
        ),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.RENAME_FILE, {
      execute: (uri) => {
        if (!uri) {
          if (this.fileTreeModelService.contextMenuFile) {
            uri = this.fileTreeModelService.contextMenuFile.uri;
          } else if (this.fileTreeModelService.focusedFile) {
            uri = this.fileTreeModelService.focusedFile.uri;
          } else {
            return;
          }
        }
        this.fileTreeModelService.renamePrompt(uri);
      },
      isVisible: () =>
        !!this.fileTreeModelService.contextMenuFile &&
        !this.fileTreeModelService.contextMenuFile.uri.isEqual(
          (this.fileTreeModelService.treeModel.root as Directory).uri,
        ),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.NEW_FILE, {
      execute: async (uri) => {
        if (this.fileTreeService.filterMode) {
          this.fileTreeService.toggleFilterMode();
        }
        if (uri) {
          this.fileTreeModelService.newFilePrompt(uri);
        } else {
          if (this.fileTreeService.isCompactMode && this.fileTreeModelService.activeUri) {
            this.fileTreeModelService.newFilePrompt(this.fileTreeModelService.activeUri);
          } else if (this.fileTreeModelService.selectedFiles && this.fileTreeModelService.selectedFiles.length > 0) {
            this.fileTreeModelService.newFilePrompt(this.fileTreeModelService.selectedFiles[0].uri);
          } else {
            let rootUri: URI;
            if (!this.fileTreeService.isMultipleWorkspace) {
              rootUri = new URI(this.workspaceService.workspace?.uri);
            } else {
              rootUri = new URI((await this.workspaceService.roots)[0].uri);
            }
            this.fileTreeModelService.newFilePrompt(rootUri);
          }
        }
      },
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.NEW_FOLDER, {
      execute: async (uri) => {
        if (this.fileTreeService.filterMode) {
          this.fileTreeService.toggleFilterMode();
        }
        if (uri) {
          this.fileTreeModelService.newDirectoryPrompt(uri);
        } else {
          if (this.fileTreeService.isCompactMode && this.fileTreeModelService.activeUri) {
            this.fileTreeModelService.newDirectoryPrompt(this.fileTreeModelService.activeUri);
          } else if (this.fileTreeModelService.selectedFiles && this.fileTreeModelService.selectedFiles.length > 0) {
            this.fileTreeModelService.newDirectoryPrompt(this.fileTreeModelService.selectedFiles[0].uri);
          } else {
            let rootUri: URI;
            if (!this.fileTreeService.isMultipleWorkspace) {
              rootUri = new URI(this.workspaceService.workspace?.uri);
            } else {
              rootUri = new URI((await this.workspaceService.roots)[0].uri);
            }
            this.fileTreeModelService.newDirectoryPrompt(rootUri);
          }
        }
      },
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COMPARE_SELECTED, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          const currentEditor = this.workbenchEditorService.currentEditor;
          if (currentEditor && currentEditor.currentUri) {
            this.fileTreeService.compare(uris[0], currentEditor.currentUri);
          }
        }
      },
      isVisible: () =>
        !!this.fileTreeModelService.contextMenuFile && !Directory.is(this.fileTreeModelService.contextMenuFile),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.OPEN_RESOURCES, {
      execute: (uri) => {
        this.fileTreeService.openAndFixedFile(uri);
      },
      isVisible: () =>
        !!this.fileTreeModelService.contextMenuFile && !Directory.is(this.fileTreeModelService.contextMenuFile),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.OPEN_TO_THE_SIDE, {
      execute: (uri) => {
        this.fileTreeService.openToTheSide(uri);
      },
      isVisible: () =>
        !!this.fileTreeModelService.contextMenuFile && !Directory.is(this.fileTreeModelService.contextMenuFile),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COPY_PATH, {
      execute: async (uri) => {
        const copyUri: URI = uri;
        let pathStr: string = decodeURIComponent(copyUri.path.toString());
        // windows下移除路径前的 /
        if ((await this.appService.backendOS) === OS.Type.Windows) {
          pathStr = pathStr.slice(1);
        }
        await this.clipboardService.writeText(pathStr);
      },
      isVisible: () => !!this.fileTreeModelService.contextMenuFile,
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COPY_RELATIVE_PATH, {
      execute: async (uri) => {
        let rootUri: URI;
        if (this.fileTreeService.isMultipleWorkspace) {
          // 多工作区额外处理
          for (const root of await this.workspaceService.roots) {
            rootUri = new URI(root.uri);
            if (rootUri.isEqual(uri)) {
              return await this.clipboardService.writeText('./');
            }
            if (rootUri.isEqualOrParent(uri)) {
              return await this.clipboardService.writeText(decodeURIComponent(rootUri.relative(uri)!.toString()));
            }
          }
        } else {
          if (this.workspaceService.workspace) {
            rootUri = new URI(this.workspaceService.workspace.uri);
            if (rootUri.isEqual(uri)) {
              return await this.clipboardService.writeText('./');
            }
            return await this.clipboardService.writeText(decodeURIComponent(rootUri.relative(uri)!.toString()));
          }
        }
      },
      isVisible: () => !!this.fileTreeModelService.contextMenuFile,
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.COPY_FILE, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          this.fileTreeModelService.copyFile(uris);
        } else {
          const selectedUris = this.fileTreeModelService.selectedFiles.map((file) => file.uri);
          if (selectedUris && selectedUris.length) {
            this.fileTreeModelService.copyFile(selectedUris);
          }
        }
      },
      isVisible: () =>
        (!!this.fileTreeModelService.contextMenuFile &&
          !this.fileTreeModelService.contextMenuFile.uri.isEqual(
            (this.fileTreeModelService.treeModel.root as Directory).uri,
          )) ||
        (!!this.fileTreeModelService.focusedFile &&
          !this.fileTreeModelService.focusedFile.uri.isEqual(
            (this.fileTreeModelService.treeModel.root as Directory).uri,
          )),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.CUT_FILE, {
      execute: (_, uris) => {
        if (uris && uris.length) {
          this.fileTreeModelService.cutFile(uris);
        } else {
          const selectedUris = this.fileTreeModelService.selectedFiles.map((file) => file.uri);
          if (selectedUris && selectedUris.length) {
            this.fileTreeModelService.cutFile(selectedUris);
          }
        }
      },
      isVisible: () =>
        (!!this.fileTreeModelService.contextMenuFile &&
          !this.fileTreeModelService.contextMenuFile.uri.isEqual(
            (this.fileTreeModelService.treeModel.root as Directory).uri,
          )) ||
        (!!this.fileTreeModelService.focusedFile &&
          !this.fileTreeModelService.focusedFile.uri.isEqual(
            (this.fileTreeModelService.treeModel.root as Directory).uri,
          )),
    });

    commands.registerCommand<ExplorerContextCallback>(FILE_COMMANDS.PASTE_FILE, {
      execute: (uri) => {
        if (uri) {
          this.fileTreeModelService.pasteFile(uri);
        } else if (this.fileTreeModelService.focusedFile) {
          let uri;
          if (this.fileTreeModelService.activeUri) {
            uri = this.fileTreeModelService.activeUri;
          } else {
            uri = this.fileTreeModelService.focusedFile.uri;
          }
          this.fileTreeModelService.pasteFile(uri);
        }
      },
      isEnabled: () =>
        this.fileTreeModelService.pasteStore && this.fileTreeModelService.pasteStore.type !== PasteTypes.NONE,
    });

    if (this.appConfig.isElectronRenderer) {
      commands.registerCommand(FILE_COMMANDS.VSCODE_OPEN_FOLDER, {
        execute: (uri?: URI, arg?: boolean | { forceNewWindow?: boolean }) => {
          const windowService: IWindowService = this.injector.get(IWindowService);
          const options = { newWindow: true };
          if (typeof arg === 'boolean') {
            options.newWindow = arg;
          } else {
            options.newWindow = typeof arg?.forceNewWindow === 'boolean' ? arg.forceNewWindow : true;
          }

          if (uri) {
            return windowService.openWorkspace(uri, options);
          }

          return this.commandService.executeCommand(FILE_COMMANDS.OPEN_FOLDER.id, options);
        },
      });

      commands.registerCommand(FILE_COMMANDS.OPEN_FOLDER, {
        execute: (options: { newWindow: boolean }) => {
          const dialogService: IElectronNativeDialogService = this.injector.get(IElectronNativeDialogService);
          const windowService: IWindowService = this.injector.get(IWindowService);
          dialogService
            .showOpenDialog({
              title: localize('workspace.openDirectory'),
              properties: ['openDirectory'],
            })
            .then((paths) => {
              if (paths && paths.length > 0) {
                windowService.openWorkspace(URI.file(paths[0]), options || { newWindow: true });
              }
            });
        },
      });

      commands.registerCommand(FILE_COMMANDS.OPEN_WORKSPACE, {
        execute: (options: { newWindow: boolean }) => {
          const supportsOpenWorkspace = this.preferenceService.get('application.supportsOpenWorkspace');
          if (!supportsOpenWorkspace) {
            return;
          }
          const dialogService: IElectronNativeDialogService = this.injector.get(IElectronNativeDialogService);
          const windowService: IWindowService = this.injector.get(IWindowService);
          dialogService
            .showOpenDialog({
              title: localize('workspace.openWorkspace'),
              properties: ['openFile'],
              filters: [
                {
                  name: localize('workspace.openWorkspaceTitle'),
                  extensions: [this.workspaceSuffixName],
                },
              ],
            })
            .then((paths) => {
              if (paths && paths.length > 0) {
                windowService.openWorkspace(URI.file(paths[0]), options || { newWindow: true });
              }
            });
        },
      });
    }

    commands.registerCommand(FILE_COMMANDS.REVEAL_IN_EXPLORER, {
      execute: (uri?: URI) => {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (handler && !handler.isVisible) {
          handler.activate();
        }
        if (handler && handler.isCollapsed(ExplorerResourceViewId)) {
          handler?.setCollapsed(ExplorerResourceViewId, false);
        }
        if (!uri && this.workbenchEditorService.currentEditor) {
          uri = this.workbenchEditorService.currentEditor.currentUri!;
        }
        if (uri) {
          this.fileTreeModelService.location(uri);
        }
      },
    });

    commands.registerCommand(FILE_COMMANDS.FOCUS_FILES, {
      execute: () => {
        const handler = this.mainLayoutService.getTabbarHandler(ExplorerContainerId);
        if (handler) {
          handler.activate();
        }
      },
    });

    // open file
    commands.registerCommand(FILE_COMMANDS.OPEN_FILE, {
      execute: (options: IOpenDialogOptions) => this.windowDialogService.showOpenDialog(options),
    });

    // save file
    commands.registerCommand(FILE_COMMANDS.SAVE_FILE, {
      execute: (options: ISaveDialogOptions) => this.windowDialogService.showSaveDialog(options),
    });

    // filter in filetree
    commands.registerCommand(FILE_COMMANDS.FILTER_TOGGLE, {
      execute: () => this.fileTreeService.toggleFilterMode(),
    });

    commands.registerCommand(FILE_COMMANDS.FILTER_OPEN, {
      execute: () => {
        if (!this.fileTreeService.filterMode) {
          return this.fileTreeService.toggleFilterMode();
        }
      },
    });

    commands.registerCommand(FILE_COMMANDS.FILTER_CLOSE, {
      execute: () => {
        if (this.fileTreeService.filterMode) {
          this.fileTreeService.toggleFilterMode();
        }
      },
    });

    commands.registerCommand(FILE_COMMANDS.NEXT, {
      execute: () => {
        this.fileTreeModelService.moveToNext();
      },
    });

    commands.registerCommand(FILE_COMMANDS.PREV, {
      execute: () => {
        this.fileTreeModelService.moveToPrev();
      },
    });

    commands.registerCommand(FILE_COMMANDS.COLLAPSE, {
      execute: () => {
        this.fileTreeModelService.collapseCurrentFile();
      },
    });

    commands.registerCommand(FILE_COMMANDS.EXPAND, {
      execute: () => {
        this.fileTreeModelService.expandCurrentFile();
      },
    });

    commands.registerCommand(WORKSPACE_COMMANDS.REMOVE_WORKSPACE_FOLDER, {
      execute: async (_: URI, uris: URI[]) => {
        if (!uris.length || !this.workspaceService.isMultiRootWorkspaceOpened) {
          return;
        }
        const roots = await this.workspaceService.roots;
        const workspaceUris = uris.filter((uri) => roots.find((file) => file.uri === uri.toString()));
        if (workspaceUris.length > 0) {
          await this.workspaceService.removeRoots(workspaceUris);
        }
      },
      isVisible: () =>
        this.workspaceService.isMultiRootWorkspaceOpened &&
        !!this.fileTreeModelService.contextMenuFile &&
        !!this.workspaceService
          .tryGetRoots()
          .find((wp) => wp.uri === this.fileTreeModelService.contextMenuFile?.uri.toString()),
    });
  }

  registerKeybindings(bindings: KeybindingRegistry) {
    bindings.registerKeybinding({
      command: FILE_COMMANDS.COPY_FILE.id,
      keybinding: 'ctrlcmd+c',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.PASTE_FILE.id,
      keybinding: 'ctrlcmd+v',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw} && !${FilesExplorerFilteredContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.CUT_FILE.id,
      keybinding: 'ctrlcmd+x',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.RENAME_FILE.id,
      keybinding: 'enter',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw} && !${FilesExplorerFilteredContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.DELETE_FILE.id,
      keybinding: 'ctrlcmd+backspace',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw} && !${FilesExplorerFilteredContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.FILTER_OPEN.id,
      keybinding: 'ctrlcmd+f',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerFilteredContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.FILTER_CLOSE.id,
      keybinding: 'esc',
      when: `${FilesExplorerFocusedContext.raw} && ${FilesExplorerFilteredContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.NEXT.id,
      keybinding: 'down',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.PREV.id,
      keybinding: 'up',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.EXPAND.id,
      keybinding: 'right',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.COLLAPSE.id,
      keybinding: 'left',
      when: `${FilesExplorerFocusedContext.raw} && !${FilesExplorerInputFocusedContext.raw}`,
    });

    bindings.registerKeybinding({
      command: FILE_COMMANDS.REVEAL_IN_EXPLORER.id,
      keybinding: 'ctrlcmd+shift+e',
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    // 点击聚焦当前编辑器 focus 的文件
    registry.registerItem({
      id: FILE_COMMANDS.LOCATION_WITH_EDITOR.id,
      command: FILE_COMMANDS.LOCATION_WITH_EDITOR.id,
      label: localize('file.location'),
      viewId: ExplorerResourceViewId,
      when: `view == '${ExplorerResourceViewId}' && !config.explorer.autoReveal && !${FilesExplorerFilteredContext.raw}`,
      // 由于目前 contextkey 设置 resourceScheme 是绑定在 editor 的 dom scope 因此设置无效
      // enabledWhen: 'resourceScheme == file',
      order: 0,
    });

    registry.registerItem({
      id: FILE_COMMANDS.NEW_FILE.id,
      command: FILE_COMMANDS.NEW_FILE.id,
      label: localize('file.new'),
      viewId: ExplorerResourceViewId,
      when: `view == '${ExplorerResourceViewId}' && !${FilesExplorerFilteredContext.raw}`,
      order: 1,
    });
    registry.registerItem({
      id: FILE_COMMANDS.NEW_FOLDER.id,
      command: FILE_COMMANDS.NEW_FOLDER.id,
      label: localize('file.folder.new'),
      viewId: ExplorerResourceViewId,
      when: `view == '${ExplorerResourceViewId}' && !${FilesExplorerFilteredContext.raw}`,
      order: 2,
    });
    registry.registerItem({
      id: FILE_COMMANDS.FILTER_TOGGLE.id,
      command: FILE_COMMANDS.FILTER_TOGGLE.id,
      label: localize('file.filetree.filter'),
      viewId: ExplorerResourceViewId,
      toggledWhen: `${FilesExplorerFilteredContext.raw}`,
      order: 3,
    });
    registry.registerItem({
      id: FILE_COMMANDS.REFRESH_ALL.id,
      command: FILE_COMMANDS.REFRESH_ALL.id,
      label: localize('file.refresh'),
      viewId: ExplorerResourceViewId,
      when: `view == '${ExplorerResourceViewId}' && !${FilesExplorerFilteredContext.raw}`,
      order: 4,
    });
    registry.registerItem({
      id: FILE_COMMANDS.COLLAPSE_ALL.id,
      command: FILE_COMMANDS.COLLAPSE_ALL.id,
      label: localize('file.collapse'),
      viewId: ExplorerResourceViewId,
      order: 5,
    });
  }
}
