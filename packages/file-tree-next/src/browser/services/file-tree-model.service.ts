import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  DecorationsManager,
  Decoration,
  TreeNodeType,
  RenamePromptHandle,
  NewPromptHandle,
  PromptValidateMessage,
  PROMPT_VALIDATE_TYPE,
  TreeNodeEvent,
  TreeModel,
  IRecycleTreeFilterHandle,
} from '@opensumi/ide-components';
import { ISerializableState, TreeStateWatcher } from '@opensumi/ide-components/lib/recycle-tree/tree/model/treeState';
import {
  CorePreferences,
  IContextKey,
  URI,
  strings,
  localize,
  arrays,
  formatLocalize,
  DisposableCollection,
  StorageProvider,
  STORAGE_NAMESPACE,
  IStorage,
  Event,
  ThrottledDelayer,
  Throttler,
  Emitter,
  Deferred,
  CommandService,
  IApplicationService,
  FILE_COMMANDS,
  path,
} from '@opensumi/ide-core-browser';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileStat } from '@opensumi/ide-file-service';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';

import { IFileTreeAPI, IFileTreeService, PasteTypes } from '../../common';
import { Directory, File } from '../../common/file-tree-node.define';
import { FileTreeModel } from '../file-tree-model';
import { FILE_TREE_NODE_HEIGHT } from '../file-tree-node';
import styles from '../file-tree-node.module.less';
import { FileTreeService } from '../file-tree.service';

import { DragAndDropService } from './file-tree-dnd.service';

const { Path, isValidBasename } = path;
const { coalesce } = arrays;
const { trim, rtrim } = strings;

export interface IPasteStore {
  files: (File | Directory)[];
  type: PasteTypes;
}

/**
 * will remove in 2.19.0
 * @deprecated use {@link IPasteStore} instead
 */
export type IParseStore = IPasteStore;

export interface IFileTreeHandle extends IRecycleTreeFilterHandle {
  hasDirectFocus: () => boolean;
}

export interface FileTreeValidateMessage extends PromptValidateMessage {
  value: string;
}

@Injectable()
export class FileTreeModelService {
  static FILE_TREE_SNAPSHOT_KEY = 'FILE_TREE_SNAPSHOT';
  static DEFAULT_REFRESHED_ACTION_DELAY = 500;
  static DEFAULT_LOCATION_FLUSH_DELAY = 200;
  static DEFAULT_LABEL_CHANGED_DELAY = 500;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IFileTreeService)
  private readonly fileTreeService: FileTreeService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IApplicationService)
  private readonly appService: IApplicationService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private _isDisposed = false;

  private _treeModel: FileTreeModel;
  private _dndService: DragAndDropService;

  private _whenReady: Deferred<void> = new Deferred();

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // ?????????
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // ?????????
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // ?????????
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // ?????????????????????
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // ?????????
  private cutDecoration: Decoration = new Decoration(styles.mod_cut); // ?????????
  // ???????????????????????????????????????????????????????????????
  private _focusedFile: File | Directory | undefined;
  // ???????????????????????????????????????
  private _selectedFiles: (File | Directory)[] = [];
  // ???????????????????????????
  private _contextMenuFile: File | Directory | undefined;

  // ???????????????????????????URI
  private _activeUri: URI | null;

  private _nextLocationTarget: URI | undefined;

  // ????????????ContextKey???????????????
  private _currentRelativeUriContextKey: IContextKey<string>;
  private _currentContextUriContextKey: IContextKey<string>;
  private _contextMenuResourceContext: ResourceContextKey;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private validateMessage: FileTreeValidateMessage | undefined;
  private _pasteStore: IPasteStore;
  private _isMultiSelected = false;

  private _explorerStorage: IStorage;

  private refreshedActionDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_REFRESHED_ACTION_DELAY);
  private labelChangedDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_LABEL_CHANGED_DELAY);
  private locationThrottler: Throttler = new Throttler();
  private onDidFocusedFileChangeEmitter: Emitter<URI | undefined> = new Emitter();
  private onDidContextMenuFileChangeEmitter: Emitter<URI | undefined> = new Emitter();
  private onDidSelectedFileChangeEmitter: Emitter<URI[]> = new Emitter();
  private onFileTreeModelChangeEmitter: Emitter<TreeModel> = new Emitter();

  private _fileToLocation: URI | string | undefined;

  private treeStateWatcher: TreeStateWatcher;
  private willSelectedNodePath: string | null;

  private _initTreeModelReady = false;

  get onDidFocusedFileChange() {
    return this.onDidFocusedFileChangeEmitter.event;
  }

  get onDidContextMenuFileChange() {
    return this.onDidContextMenuFileChangeEmitter.event;
  }

  get onDidSelectedFileChange() {
    return this.onDidSelectedFileChangeEmitter.event;
  }

  get onFileTreeModelChange(): Event<TreeModel> {
    return this.onFileTreeModelChangeEmitter.event;
  }

  get fileTreeHandle() {
    return this._fileTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
  }

  get dndService() {
    return this._dndService;
  }

  get whenReady() {
    return this._whenReady.promise;
  }

  // ???????????????????????????????????????
  get focusedFile() {
    return this._focusedFile;
  }

  set focusedFile(value: File | Directory | undefined) {
    this.onDidFocusedFileChangeEmitter.fire(value ? value.uri : undefined);
    this._focusedFile = value;
  }

  // ???????????????????????????
  get contextMenuFile() {
    return this._contextMenuFile;
  }

  set contextMenuFile(value: File | Directory | undefined) {
    this.onDidContextMenuFileChangeEmitter.fire(value ? value.uri : undefined);
    this._contextMenuFile = value;
  }

  // ?????????????????????????????????
  get selectedFiles() {
    return this._selectedFiles;
  }

  set selectedFiles(value: (File | Directory)[]) {
    this.onDidSelectedFileChangeEmitter.fire(value ? value.map((v) => v.uri) : []);
    this._selectedFiles = value;
  }

  // ???????????????????????????URI????????????????????????????????????
  get activeUri() {
    return this._activeUri;
  }

  get pasteStore() {
    return this._pasteStore;
  }

  get explorerStorage() {
    return this._explorerStorage;
  }

  get currentRelativeUriContextKey(): IContextKey<string> {
    if (!this._currentRelativeUriContextKey) {
      this._currentRelativeUriContextKey = this.fileTreeService.contextMenuContextKeyService.createKey(
        'filetreeContextRelativeUri',
        '',
      );
    }
    return this._currentRelativeUriContextKey;
  }

  get currentContextUriContextKey(): IContextKey<string> {
    if (!this._currentContextUriContextKey) {
      this._currentContextUriContextKey = this.fileTreeService.contextMenuContextKeyService.createKey(
        'filetreeContextUri',
        '',
      );
    }
    return this._currentContextUriContextKey;
  }

  get contextMenuResourceContext(): ResourceContextKey {
    if (!this._contextMenuResourceContext) {
      this._contextMenuResourceContext = new ResourceContextKey(this.fileTreeService.contextMenuContextKeyService);
    }
    return this._contextMenuResourceContext;
  }

  get contextKey() {
    return this.fileTreeService.contextKey;
  }

  get initTreeModelReady() {
    return this._initTreeModelReady;
  }

  async initTreeModel() {
    this._initTreeModelReady = false;
    // ????????????????????????????????????????????????
    const root = (await this.fileTreeService.resolveChildren())[0];
    if (!root) {
      this._whenReady.resolve();
      return;
    }
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
    this.initDecorations(root);
    // _dndService???????????????????????????
    this._dndService = this.injector.get<any>(DragAndDropService, [this]);
    // ?????????????????????????????????????????????????????? CollapsedAll ??? Location
    this.disposableCollection.push(
      this.fileTreeService.requestFlushEventSignalEvent(async () => await this.canHandleRefreshEvent()),
    );
    // ???????????????????????????????????????????????? treeStateWatcher, ????????????????????????
    this.treeStateWatcher = this._treeModel.getTreeStateWatcher(true);
    this.disposableCollection.push(
      this.fileTreeService.onNodeRefreshed(() => {
        if (!this.initTreeModelReady) {
          return;
        }
        if (!this.refreshedActionDelayer.isTriggered) {
          this.refreshedActionDelayer.cancel();
        }
        this.refreshedActionDelayer.trigger(async () => {
          // ?????????????????????????????????????????????????????????
          if (this.selectedFiles.length === 0) {
            const currentEditor = this.editorService.currentEditor;
            if (currentEditor && currentEditor.currentUri) {
              this.location(currentEditor.currentUri);
            }
          }
          if (!this.fileTreeService.isCompactMode) {
            this._activeUri = null;
          }
        });
      }),
    );
    this.disposableCollection.push(
      this.fileTreeService.onWorkspaceChange(() => {
        this.disposableCollection.dispose();
        this.initTreeModel();
      }),
    );
    this.disposableCollection.push(
      this.treeModel?.onWillUpdate(() => {
        if (!this.initTreeModelReady) {
          return;
        }
        // ?????????????????????????????????
        if (this.willSelectedNodePath) {
          const node = this.treeModel.root.getTreeNodeByPath(this.willSelectedNodePath) as File;
          if (node) {
            this.selectFileDecoration(node, false);
            this.willSelectedNodePath = null;
          }
        }

        if (this.contextMenuFile) {
          const node = this.treeModel?.root.getTreeNodeByPath(this.contextMenuFile.path);
          if (node) {
            this.contextMenuDecoration.removeTarget(this.contextMenuFile);
            this.contextMenuFile = node as File;
            this.contextMenuDecoration.addTarget(node);
          }
        }

        if (this.focusedFile) {
          const node = this.treeModel?.root.getTreeNodeByPath(this.focusedFile.path);
          if (node) {
            this.focusedDecoration.removeTarget(this.focusedFile);
            this.focusedFile = node as File;
            this.focusedDecoration.addTarget(node);
          }
        }

        if (this.selectedFiles.length !== 0) {
          const nodes: (File | Directory)[] = [];
          this.selectedFiles.forEach((file) => {
            this.selectedDecoration.removeTarget(file);
          });
          for (const file of this.selectedFiles) {
            const node = this.treeModel?.root.getTreeNodeByPath(file.path);
            if (node) {
              this.selectedDecoration.addTarget(node);
              nodes.push(node as File);
            }
          }
          this._selectedFiles = nodes;
        }
      }),
    );
    // ???labelService?????????????????????????????????????????????????????????
    this.disposableCollection.push(
      this.labelService.onDidChange(async () => {
        if (!this.initTreeModelReady) {
          return;
        }
        if (!this.labelChangedDelayer.isTriggered()) {
          this.labelChangedDelayer.cancel();
        }
        this.labelChangedDelayer.trigger(async () => {
          this.fileTreeService.refresh();
        });
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
        this.loadingDecoration.addTarget(target);
        this.treeModel.dispatchChange();
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
        this.treeModel.dispatchChange();
      }),
    );
    this._explorerStorage = await this.storageProvider(STORAGE_NAMESPACE.EXPLORER);
    // ??????????????????????????????
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      // ????????????????????????????????????????????????????????????
      await this.loadFileTreeSnapshot(snapshot);
    }
    // ????????????????????????????????????????????? Tree ?????????????????????
    this.disposableCollection.push(
      this.treeStateWatcher.onDidChange(() => {
        if (!this._initTreeModelReady) {
          return;
        }
        const snapshot = this.explorerStorage.get<any>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
        const currentTreeSnapshot = this.treeStateWatcher.snapshot();
        this.explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, {
          ...snapshot,
          ...currentTreeSnapshot,
        });
      }),
    );
    await this.fileTreeService.startWatchFileEvent();
    this.onFileTreeModelChangeEmitter.fire(this._treeModel);

    this._whenReady.resolve();
    this._initTreeModelReady = true;
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.cutDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  /**
   * ??????????????????????????????????????????????????????????????????
   * ????????????????????????????????????????????????????????????
   * ????????????????????????????????????????????????????????????
   * @param node ????????????
   */
  private setFileTreeContextKey(node: Directory | File) {
    this.currentContextUriContextKey.set(node.uri.toString());
    this.currentRelativeUriContextKey.set(((this.treeModel.root as Directory).uri.relative(node.uri) || '').toString());
    this.contextMenuResourceContext.set(node.uri);

    this.contextKey?.explorerResourceIsFolder.set(node && node.type === TreeNodeType.CompositeTreeNode);
  }

  private async loadFileTreeSnapshot(snapshot: ISerializableState) {
    await this._treeModel.loadTreeState(snapshot);
  }

  private async canHandleRefreshEvent() {
    await this.whenReady;
  }

  // ???????????????????????????
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  };

  // ??????????????????/??????????????????????????????????????????
  activeFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this.contextMenuFile = undefined;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        // ?????????????????????????????????????????????????????????????????????selectedFiles?????????
        // ?????????????????????????????????????????????????????????????????????
        for (const target of this.selectedDecoration.appliedTargets.keys()) {
          this.selectedDecoration.removeTarget(target);
        }
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this.focusedFile = target;
      this.selectedFiles = [target];
      // ??????????????????
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // ??????????????????/??????????????????????????????????????????
  selectFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
      return;
    }

    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this.contextMenuFile = undefined;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this._selectedFiles = [target];
      // ??????????????????
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // ???????????????????????????
  activateFileActivedDecoration = (target: File | Directory) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
    }
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.focusedFile = undefined;
    }
    this.contextMenuDecoration.addTarget(target);
    this.contextMenuFile = target;
    this.treeModel.dispatchChange();
  };

  // ???????????????????????????
  activateFileFocusedDecoration = (target: File | Directory) => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
    }
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this.contextMenuFile = undefined;
    }
    this.focusedDecoration.addTarget(target);
    this.focusedFile = target;
    this.treeModel.dispatchChange();
  };

  // ?????????????????????????????????????????????????????????
  // removePreFocusedDecoration ??????????????????????????????????????????????????????????????????????????????????????????????????????
  activeFileFocusedDecoration = (target: File | Directory, removePreFocusedDecoration = false) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        if (this.focusedFile) {
          // ??????????????????????????????????????????
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this.contextMenuFile = target;
      } else if (this.focusedFile) {
        this.contextMenuFile = undefined;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        // ??????????????????????????????????????????
        if (this._selectedFiles.indexOf(target) < 0) {
          this.selectedDecoration.addTarget(target);
          this._selectedFiles.push(target);
          this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
        }
        this.focusedDecoration.addTarget(target);
        this.focusedFile = target;
      }
    }
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ?????????????????????????????????????????????
  toggleFileSelectedDecoration = (target: File | Directory) => {
    const index = this._selectedFiles.indexOf(target);
    if (index > -1) {
      if (this.focusedFile === target) {
        this.focusedDecoration.removeTarget(this.focusedFile);
        this.focusedFile = undefined;
      }
      this._selectedFiles.splice(index, 1);
      this.selectedDecoration.removeTarget(target);
    } else {
      this._selectedFiles.push(target);
      this.selectedDecoration.addTarget(target);
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.focusedFile = target;
      this.focusedDecoration.addTarget(target);
    }
    // ??????????????????
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ??????????????????????????????
  activeFileDecorationByRange = (begin: number, end: number) => {
    this.clearFileSelectedDecoration();
    this.contextMenuFile = undefined;
    for (; begin <= end; begin++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (file) {
        this._selectedFiles.push(file as File);
        this.selectedDecoration.addTarget(file);
      }
    }
    // ??????????????????
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ????????????????????????
  deactivateFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.focusedFile = undefined;
    }
    // ?????????????????????????????????????????????????????????
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
    }
    this.treeModel?.dispatchChange();
  };

  toggleDirectory = async (item: Directory) => {
    if (item.expanded) {
      this.fileTreeHandle.collapseNode(item);
    } else {
      this.fileTreeHandle.expandNode(item);
    }
  };

  handleDblClick = () => {
    this.commandService.executeCommand(FILE_COMMANDS.NEW_FILE.id);
  };

  handleContextMenu = (ev: React.MouseEvent, file?: File | Directory, activeUri?: URI) => {
    ev.stopPropagation();
    ev.preventDefault();

    let nodes: (File | Directory)[];
    let node: File | Directory;

    if (!file) {
      // ????????????????????????
      nodes = [this.treeModel.root as Directory];
      node = this.treeModel.root as Directory;
    } else {
      node = file;
      if (this._isMultiSelected) {
        if (this.selectedFiles.indexOf(node) >= 0) {
          nodes = this.selectedFiles;
        } else {
          nodes = [node];
        }
      } else {
        nodes = [node];
      }
    }

    this.activateFileActivedDecoration(node);

    this.setFileTreeContextKey(node);

    // ???????????????????????? contextKey ???????????????????????????????????????
    if (this.fileTreeService.isCompactMode && activeUri) {
      this._activeUri = activeUri;
      // ?????? activeUri ??????????????? explorerResourceIsFolder ???????????? true
      this.contextKey?.explorerResourceIsFolder.set(true);
    } else if (!activeUri) {
      this._activeUri = null;
    }

    const menus = this.contextMenuService.createMenu({
      id: MenuId.ExplorerContext,
      contextKeyService: this.fileTreeService.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    // ??????????????????????????? ContextKey
    this.updateExplorerCompressedContextKey(node, activeUri);

    const { x, y } = ev.nativeEvent;

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: activeUri ? [activeUri, [activeUri]] : [node.uri, nodes.map((node) => node.uri)],
    });
  };

  updateExplorerCompressedContextKey(node?: File | Directory, activeUri?: URI) {
    if (node && activeUri) {
      this.contextKey?.explorerCompressedFocusContext.set(true);
      const compressedNamePath = new Path(node.name);
      if (compressedNamePath.name === activeUri.displayName) {
        // ??????????????????????????????
        this.contextKey?.explorerCompressedLastFocusContext.set(true);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      } else if (compressedNamePath.root && compressedNamePath.root.name === activeUri.displayName) {
        // ??????????????????????????????
        this.contextKey?.explorerCompressedLastFocusContext.set(false);
        this.contextKey?.explorerCompressedFirstFocusContext.set(true);
      } else {
        // ??????????????????????????????
        this.contextKey?.explorerCompressedLastFocusContext.set(false);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      }
    } else if (node) {
      // ????????????????????????????????????????????????????????????????????????
      if (node.name.indexOf(Path.separator) > 0) {
        this.contextKey?.explorerCompressedFocusContext.set(true);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
        this.contextKey?.explorerCompressedLastFocusContext.set(true);
      } else {
        this.contextKey?.explorerCompressedFocusContext.set(false);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
        this.contextKey?.explorerCompressedLastFocusContext.set(false);
      }
    } else {
      this.contextKey?.explorerCompressedFocusContext.set(false);
      this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      this.contextKey?.explorerCompressedLastFocusContext.set(false);
    }
  }

  handleTreeHandler(handle: IFileTreeHandle) {
    this._fileTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // file-tree ????????????????????? handleTreeBlue????????? fileTreeContextKey ???????????????????????????????????? service ?????? dispose ???
    if (this._isDisposed) {
      return;
    }
    this.contextKey?.filesExplorerFocused?.set(false);
    // ??????????????????????????????????????????????????????
    // ??????????????????
    this.deactivateFileDecoration();
    // ?????????????????? explorerResourceIsFolder ???????????? false
    this.contextKey?.explorerResourceIsFolder.set(false);
  };

  handleTreeFocus = () => {
    // ????????????
    this.contextKey?.filesExplorerFocused?.set(true);
  };

  handleItemRangeClick = (item: File | Directory, type: TreeNodeType) => {
    if (!this.focusedFile) {
      this.handleItemClick(item, type);
    } else if (this.focusedFile && this.focusedFile !== item) {
      this._isMultiSelected = true;
      const targetIndex = this.treeModel.root.getIndexAtTreeNode(item);
      const preFocusedFileIndex = this.treeModel.root.getIndexAtTreeNode(this.focusedFile);
      if (preFocusedFileIndex > targetIndex) {
        this.activeFileDecorationByRange(targetIndex, preFocusedFileIndex);
      } else if (preFocusedFileIndex < targetIndex) {
        this.activeFileDecorationByRange(preFocusedFileIndex, targetIndex);
      }
    }
  };

  handleItemToggleClick = (item: File | Directory, type: TreeNodeType) => {
    this._isMultiSelected = true;
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }

    // ??????????????????????????????????????????
    this.toggleFileSelectedDecoration(item);
  };

  /**
   * ???????????? `item` ??? `undefined` ????????????????????????????????????
   * ?????????????????? `type` ??? `TreeNodeType.TreeNode`
   * ??????????????? `type` ??? `TreeNodeType.CompositeTreeNode`
   *
   * @param item ??????
   * @param type ????????????
   * @param activeUri ????????????
   */
  handleItemClick = (
    item?: File | Directory,
    type: TreeNodeType = this.fileTreeService.isMultipleWorkspace
      ? TreeNodeType.TreeNode
      : TreeNodeType.CompositeTreeNode,
    activeUri?: URI,
  ) => {
    if (!this.treeModel) {
      return;
    }

    if (!item) {
      item = this.treeModel.root as Directory | File;
    }
    // ???????????????????????????Contextkey
    this.updateExplorerCompressedContextKey(item, activeUri);

    this._isMultiSelected = false;
    if (this.fileTreeService.isCompactMode && activeUri) {
      this._activeUri = activeUri;
      // ?????? activeUri ??????????????? explorerResourceIsFolder ???????????? true
      this.contextKey?.explorerResourceIsFolder.set(true);
    } else if (!activeUri) {
      this._activeUri = null;
      // ???????????????????????????????????????
      if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
        this.activeFileDecoration(item);
      }
      this.contextKey?.explorerResourceIsFolder.set(type === TreeNodeType.CompositeTreeNode);
    }

    // ???????????????????????????
    // ???????????????????????????????????????
    if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
      if (type === TreeNodeType.CompositeTreeNode) {
        this.contextKey?.explorerResourceIsFolder.set(true);
        if (item === this.treeModel.root) {
          // ????????????????????????????????????
          return;
        }
        this.toggleDirectory(item as Directory);
      } else if (type === TreeNodeType.TreeNode) {
        this.contextKey?.explorerResourceIsFolder.set(false);
        if (item === this.treeModel.root) {
          // ????????????????????????????????????
          return;
        }
        // ????????????????????????????????? openFile ????????? editor.previewMode ?????????
        this.fileTreeService.openFile(item.uri);
      }
    }
  };

  handleItemDoubleClick = (item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
    // ???????????????????????????????????? handleItemClick ??????????????????
    if (type === TreeNodeType.TreeNode) {
      // ???????????????????????? workbench.list.openMode ?????????????????????????????????????????????????????????
      this.fileTreeService.openAndFixedFile(item.uri);
    } else {
      if (this.corePreferences['workbench.list.openMode'] === 'doubleClick') {
        this.toggleDirectory(item as Directory);
      }
    }
  };

  public moveToNext() {
    let node;
    if (this.focusedFile) {
      node = this.focusedFile;
    } else if (this.contextMenuFile) {
      node = this.contextMenuFile;
    }
    if (!node) {
      // ?????????????????????????????????????????????
      return;
    }
    const currentIndex = this.treeModel.root.getIndexAtTreeNode(node);
    const nextIndex = currentIndex + 1;
    const nextFileNode = this.treeModel.root.getTreeNodeAtIndex(nextIndex);
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    const offsetHeight = (nextIndex + 1) * FILE_TREE_NODE_HEIGHT - (snapshot.scrollPosition || 0);
    const { height } = this.fileTreeHandle.getCurrentSize();
    if (!nextFileNode) {
      return;
    }
    this.activateFileFocusedDecoration(nextFileNode as File);
    if (offsetHeight > height) {
      this.fileTreeHandle.ensureVisible(nextFileNode as File, 'end');
    }
  }

  public moveToPrev() {
    let node;
    if (this.focusedFile) {
      node = this.focusedFile;
    } else if (this.contextMenuFile) {
      node = this.contextMenuFile;
    }
    if (!node) {
      // ?????????????????????????????????????????????
      return;
    }
    const currentIndex = this.treeModel.root.getIndexAtTreeNode(node);
    if (currentIndex === 0) {
      return;
    }
    const prevIndex = currentIndex - 1;
    const prevFileNode = this.treeModel.root.getTreeNodeAtIndex(prevIndex);
    if (!prevFileNode) {
      return;
    }
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    const offsetHeight = prevIndex * FILE_TREE_NODE_HEIGHT;
    this.activateFileFocusedDecoration(prevFileNode as File);
    if ((snapshot.scrollPosition || 0) > offsetHeight) {
      this.fileTreeHandle.ensureVisible(prevFileNode as File, 'start');
    }
  }

  public async collapseCurrentFile() {
    let node;
    if (this.focusedFile) {
      node = this.focusedFile;
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.focusedFile = undefined;
    } else if (this.contextMenuFile) {
      node = this.contextMenuFile;
      this.focusedDecoration.removeTarget(this.contextMenuFile);
      this.contextMenuFile = undefined;
    }
    const index = this.selectedFiles.indexOf(node);
    if (index >= 0) {
      this.selectedFiles.splice(index, 1);
      this.selectedDecoration.removeTarget(node);
    }
    let target: Directory;
    if (Directory.is(node) && node.expanded) {
      target = node as Directory;
    } else if (node) {
      if (Directory.isRoot(node.parent)) {
        target = node as Directory;
      } else {
        target = node.parent as Directory;
      }
    } else {
      return;
    }
    this.focusedFile = target;
    if (target && target.expanded) {
      await this.fileTreeHandle.collapseNode(target as Directory);
      this.activeFileFocusedDecoration(target as Directory, true);
    }
  }

  public async expandCurrentFile() {
    let node;
    if (this.focusedFile) {
      node = this.focusedFile;
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.focusedFile = undefined;
    } else if (this.contextMenuFile) {
      node = this.contextMenuFile;
      this.focusedDecoration.removeTarget(this.contextMenuFile);
      this.contextMenuFile = undefined;
    }
    const index = this.selectedFiles.indexOf(node);
    if (index >= 0) {
      this.selectedFiles.splice(index, 1);
      this.selectedDecoration.removeTarget(node);
    }
    this.focusedFile = node as Directory;
    if (Directory.is(node)) {
      if (!node.expanded) {
        await this.fileTreeHandle.expandNode(node as Directory);
      }
    }
  }

  // ????????????
  async collapseAll() {
    await this.treeModel.root.collapsedAll();
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      // ????????????????????????????????????????????????????????????????????????????????????
      this.explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, {
        ...snapshot,
        expandedDirectories: {
          atSurface: [],
          buried: [],
        },
      });
    }
  }

  async deleteFileByUris(uris: URI[]) {
    if (uris.length === 0) {
      return;
    }
    if (this.corePreferences['explorer.confirmDelete']) {
      const ok = localize('file.confirm.delete.ok');
      const cancel = localize('file.confirm.delete.cancel');
      const deleteFilesMessage = `[ ${uris
        .slice(0, 5)
        .map((uri) => uri.displayName)
        .join(',')}${uris.length > 5 ? ' ...' : ''} ]`;

      const confirm = await this.dialogService.warning(formatLocalize('file.confirm.delete', deleteFilesMessage), [
        cancel,
        ok,
      ]);
      if (confirm !== ok) {
        return;
      }
    }

    const roots = this.fileTreeService.sortPaths(uris);
    let nextFocusedFile;
    if (this.treeModel.root.branchSize === uris.length) {
      nextFocusedFile = undefined;
    } else if (
      this.selectedFiles.length &&
      !roots.find((root) => root.path.toString() === this.selectedFiles[0].uri.toString())
    ) {
      // ??????????????????????????????????????????????????????????????????
      nextFocusedFile = this.selectedFiles[0];
    } else {
      const lastFile = roots[roots.length - 1].node;
      const lastIndex = this.treeModel.root.getIndexAtTreeNode(lastFile);
      let nextIndex = lastIndex + 1;
      if (nextIndex >= this.treeModel.root.branchSize) {
        const firstFile = roots[0].node;
        const firstIndex = this.treeModel.root.getIndexAtTreeNode(firstFile);
        nextIndex = firstIndex - 1;
      }
      nextFocusedFile = this.treeModel.root.getTreeNodeAtIndex(nextIndex);
    }

    const toPromise = [] as Promise<boolean>[];

    roots.forEach((root) => {
      this.loadingDecoration.addTarget(root.node);
      toPromise.push(
        this.deleteFile(root.node, root.path).then((v) => {
          this.loadingDecoration.removeTarget(root.node);
          return v;
        }),
      );
    });
    this.treeModel.dispatchChange();
    await Promise.all(toPromise);
    // ???????????????????????????????????????
    if (nextFocusedFile) {
      this.activeFileDecoration(nextFocusedFile);
    }
  }

  async deleteFile(node: File | Directory, path: URI | string): Promise<boolean> {
    const uri = typeof path === 'string' ? new URI(path) : (path as URI);

    const error = await this.fileTreeAPI.delete(uri);
    if (error) {
      this.messageService.error(error);
      return false;
    }

    const processNode = (_node: Directory | File) => {
      if (_node.uri.isEqual(uri)) {
        this.fileTreeService.deleteAffectedNodeByPath(_node.path);
      } else {
        // ???????????????????????????????????????
        this.fileTreeService.refresh(node.parent as Directory);
      }
      this.loadingDecoration.removeTarget(_node);

      // ???????????????????????????
      this.contextKey?.explorerCompressedFocusContext.set(false);
      this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      this.contextKey?.explorerCompressedLastFocusContext.set(false);
    };
    processNode(node);
    return true;
  }

  private getWellFormedFileName(filename: string): string {
    if (!filename) {
      return filename;
    }

    // ????????????
    filename = trim(filename, '\t');

    // ??????????????? . / \\
    filename = rtrim(filename, '.');
    filename = rtrim(filename, '/');
    filename = rtrim(filename, '\\');

    return filename;
  }

  private trimLongName(name: string): string {
    if (name && name.length > 255) {
      return `${name.substr(0, 255)}...`;
    }
    return name;
  }

  private validateFileName = (
    promptHandle: RenamePromptHandle | NewPromptHandle,
    name: string,
  ): FileTreeValidateMessage | null => {
    // ????????????????????????
    name = this.getWellFormedFileName(name);

    // ?????????????????????
    if (!name || name.length === 0 || /^\s+$/.test(name)) {
      return {
        message: localize('validate.tree.emptyFileNameError'),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    // ????????????????????????????????????
    if (name[0] === '/' || name[0] === '\\') {
      return {
        message: localize('validate.tree.fileNameStartsWithSlashError'),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    // ????????????????????????????????????????????????
    if (name[0] === ' ' || name[name.length - 1] === ' ') {
      return {
        message: localize('validate.tree.fileNameFollowOrStartWithSpaceWarning'),
        type: PROMPT_VALIDATE_TYPE.WARNING,
        value: name,
      };
    }

    let parent: Directory;

    if ((promptHandle as RenamePromptHandle).target) {
      const target = (promptHandle as RenamePromptHandle).target as File | Directory;
      if (name === target.name) {
        return null;
      }
      parent = target.parent as Directory;
    } else {
      parent = (promptHandle as NewPromptHandle).parent as Directory;
    }

    // ????????????????????????????????????????????????????????????
    if (parent) {
      const isCompactNodeRenamed =
        promptHandle instanceof RenamePromptHandle &&
        (promptHandle.target as File).displayName.indexOf(Path.separator) > 0;
      if (!isCompactNodeRenamed) {
        // ?????????????????????????????????
        const child = parent.children?.find((child) => child.name === name);
        if (child) {
          return {
            message: formatLocalize('validate.tree.fileNameExistsError', name),
            type: PROMPT_VALIDATE_TYPE.ERROR,
            value: name,
          };
        }
      }
    }

    const names = coalesce(name.split(/[\\/]/));
    // ???????????????????????????
    if (names.some((folderName) => !isValidBasename(folderName))) {
      return {
        message: formatLocalize('validate.tree.invalidFileNameError', this.trimLongName(name)),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    return null;
  };

  private proxyPrompt = (promptHandle: RenamePromptHandle | NewPromptHandle) => {
    let isCommit = false;
    const selectNodeIfNodeExist = async (path: string) => {
      // ??????????????????????????????????????????
      const node = await this.fileTreeService.getNodeByPathOrUri(path);
      if (node && node.path === path) {
        this.selectFileDecoration(node);
      }
    };
    const commit = async (newName) => {
      this.validateMessage = undefined;
      if (promptHandle instanceof RenamePromptHandle) {
        const target = promptHandle.target as File | Directory;
        const nameFragments = (promptHandle.target as File).displayName.split(Path.separator);
        const index = this.activeUri?.displayName ? nameFragments.indexOf(this.activeUri?.displayName) : -1;
        const newNameFragments = index === -1 ? [] : nameFragments.slice(0, index).concat(newName);
        let from = target.uri;
        let to = (target.parent as Directory).uri.resolve(newName);
        const isCompactNode = target.name.indexOf(Path.separator) > 0;
        // ????????????????????????
        if ((isCompactNode && this.activeUri?.displayName === newName) || (!isCompactNode && newName === target.name)) {
          return true;
        }
        promptHandle.addAddonAfter('loading_indicator');
        if (isCompactNode && newNameFragments.length > 0) {
          // ?????????????????????????????????????????????????????????????????????
          from = (target.parent as Directory).uri.resolve(nameFragments.slice(0, index + 1).join(Path.separator));
          to = (target.parent as Directory).uri.resolve(newNameFragments.concat().join(Path.separator));
        }
        // ???????????????????????????
        const error = await this.fileTreeAPI.mv(from, to, target.type === TreeNodeType.CompositeTreeNode);
        if (error) {
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        if (!isCompactNode && target.parent) {
          // ????????????????????????????????????????????????????????????
          const node = await this.fileTreeService.moveNodeByPath(
            target.parent as Directory,
            target.parent as Directory,
            target.name,
            newName,
            target.type,
          );
          if (node) {
            this.selectFileDecoration(node as File, false);
          }
        } else {
          // ??????????????????????????????
          // ????????????????????????????????????????????????
          // ?????????????????????????????????????????????uri, filestat???
          (target as Directory).updateMetaData({
            name: newNameFragments.concat(nameFragments.slice(index + 1)).join(Path.separator),
            uri: to,
            fileStat: {
              ...target.filestat,
              uri: to.toString(),
            },
            tooltip: this.fileTreeAPI.getReadableTooltip(to),
          });
          this.treeModel.dispatchChange();
          if ((target.parent as Directory).children?.find((child) => target.path.indexOf(child.path) >= 0)) {
            // ?????????????????????????????????????????????????????????????????????????????????
            // ??????
            // ???????????? 001/002 ????????? 003/002 ???
            // ???????????????????????? 003 ?????????
            await this.fileTreeService.refresh(target.parent as Directory);
          } else {
            // ???????????????????????????????????????????????????????????????
            await this.fileTreeService.refresh(target as Directory);
          }
        }
        promptHandle.removeAddonAfter();
      } else if (promptHandle instanceof NewPromptHandle) {
        const parent = promptHandle.parent as Directory;
        const newUri = parent.uri.resolve(newName);
        let error;
        const isEmptyDirectory = !parent.children || parent.children.length === 0;
        promptHandle.addAddonAfter('loading_indicator');
        if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
          error = await this.fileTreeAPI.createDirectory(newUri);
        } else {
          error = await this.fileTreeAPI.createFile(newUri);
        }
        promptHandle.removeAddonAfter();
        if (error) {
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        if (this.fileTreeService.isCompactMode && newName.indexOf(Path.separator) > 0 && !Directory.isRoot(parent)) {
          // ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
          const parentPath = new Path(parent.path).join(Path.splitPath(newName)[0]).toString();
          const parentNode = this.fileTreeService.getNodeByPathOrUri(parentPath) as Directory;
          if (parentNode) {
            if (!parentNode.expanded && !parentNode.children) {
              await parentNode.setExpanded(true);
              // ??????uri?????????????????????????????????????????????????????????????????????????????????????????????????????????
              selectNodeIfNodeExist(new Path(parent.path).join(newName).toString());
            } else {
              await this.fileTreeService.refresh(parentNode as Directory);
              selectNodeIfNodeExist(new Path(parent.path).join(newName).toString());
            }
          } else {
            // ?????????????????????????????????
            if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
              if (isEmptyDirectory) {
                const newNodeName = [parent.name].concat(newName).join(Path.separator);
                parent.updateMetaData({
                  name: newNodeName,
                  uri: parent.uri.resolve(newName),
                  fileStat: {
                    ...parent.filestat,
                    uri: parent.uri.resolve(newName).toString(),
                  },
                  tooltip: this.fileTreeAPI.getReadableTooltip(parent.uri.resolve(newName)),
                });
                selectNodeIfNodeExist(parent.path);
              } else {
                const addNode = await this.fileTreeService.addNode(parent, newName, promptHandle.type);
                // ???????????????????????????????????????????????????????????????
                selectNodeIfNodeExist(addNode.path);
              }
            } else if (promptHandle.type === TreeNodeType.TreeNode) {
              const namePieces = Path.splitPath(newName);
              const parentAddonPath = namePieces.slice(0, namePieces.length - 1).join(Path.separator);
              const fileName = namePieces.slice(-1)[0];
              const parentUri = parent.uri.resolve(parentAddonPath);
              const newNodeName = [parent.name].concat(parentAddonPath).join(Path.separator);
              parent.updateMetaData({
                name: newNodeName,
                uri: parentUri,
                fileStat: {
                  ...parent.filestat,
                  uri: parentUri.toString(),
                },
                tooltip: this.fileTreeAPI.getReadableTooltip(parentUri),
              });
              const addNode = (await this.fileTreeService.addNode(parent, fileName, TreeNodeType.TreeNode)) as File;
              selectNodeIfNodeExist(addNode.path);
            }
          }
        } else {
          if (
            this.fileTreeService.isCompactMode &&
            promptHandle.type === TreeNodeType.CompositeTreeNode &&
            isEmptyDirectory &&
            !Directory.isRoot(parent)
          ) {
            const parentUri = parent.uri.resolve(newName);
            const newNodeName = [parent.name].concat(newName).join(Path.separator);
            parent.updateMetaData({
              name: newNodeName,
              uri: parentUri,
              fileStat: {
                ...parent.filestat,
                uri: parentUri.toString(),
              },
              tooltip: this.fileTreeAPI.getReadableTooltip(parentUri),
            });
            selectNodeIfNodeExist(parent.path);
          } else {
            await this.fileTreeService.addNode(parent, newName, promptHandle.type);
            selectNodeIfNodeExist(new Path(parent!.path).join(newName).toString());
          }
        }
      }
      this.contextKey?.filesExplorerInputFocused.set(false);
      return true;
    };

    const blurCommit = async (newName) => {
      if (isCommit) {
        return false;
      }
      if (!!this.validateMessage && this.validateMessage.type === PROMPT_VALIDATE_TYPE.ERROR) {
        this.validateMessage = undefined;
        return true;
      }
      if (!newName) {
        // ???????????????????????????
        this.contextKey?.explorerCompressedFocusContext.set(false);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
        this.contextKey?.explorerCompressedLastFocusContext.set(false);
        if (this.fileTreeService.isCompactMode && promptHandle instanceof NewPromptHandle) {
          this.fileTreeService.refresh(promptHandle.parent as Directory);
        }
        return;
      }
      this.contextKey?.filesExplorerInputFocused.set(false);
      await commit(newName);
      return true;
    };
    const enterCommit = async (newName) => {
      isCommit = true;
      if (!!this.validateMessage && this.validateMessage.type === PROMPT_VALIDATE_TYPE.ERROR) {
        return false;
      }
      if (
        newName.trim() === '' ||
        (!!this.validateMessage && this.validateMessage.type !== PROMPT_VALIDATE_TYPE.ERROR)
      ) {
        this.validateMessage = undefined;
        return true;
      }
      const success = await commit(newName);
      isCommit = false;

      if (!success) {
        return false;
      }
      // ??????true????????????????????????
      return true;
    };
    const handleFocus = async () => {
      this.contextKey?.filesExplorerInputFocused.set(true);
    };
    const handleDestroy = () => {
      this.contextKey?.filesExplorerInputFocused.set(false);
      if (this.contextMenuFile) {
        // ???????????????????????????????????????
        this.selectFileDecoration(this.contextMenuFile, true);
      }
    };
    const handleCancel = () => {
      this.contextKey?.filesExplorerInputFocused.set(false);
      if (this.fileTreeService.isCompactMode) {
        if (promptHandle instanceof NewPromptHandle) {
          this.fileTreeService.refresh(promptHandle.parent as Directory);
        }
      }
    };
    const handleChange = (currentValue) => {
      const validateMessage = this.validateFileName(promptHandle, currentValue);
      if (validateMessage) {
        this.validateMessage = validateMessage;
        promptHandle.addValidateMessage(validateMessage);
      } else if (!validateMessage && this.validateMessage && this.validateMessage.value !== currentValue) {
        this.validateMessage = undefined;
        promptHandle.removeValidateMessage();
      }
    };
    if (!promptHandle.destroyed) {
      promptHandle.onChange(handleChange);
      promptHandle.onCommit(enterCommit);
      promptHandle.onBlur(blurCommit);
      promptHandle.onFocus(handleFocus);
      promptHandle.onDestroy(handleDestroy);
      promptHandle.onCancel(handleCancel);
    }
    // ????????????????????????????????????/?????????????????????
    // ??????????????????????????????
    this.disposableCollection.push(
      Event.once(this.fileTreeService.onNodeRefreshed)(() => {
        if (promptHandle && !promptHandle.destroyed) {
          promptHandle.destroy();
        }
      }),
    );
  };

  private async getPromptTarget(uri: URI, isCreatingFile?: boolean) {
    let targetNode: File | Directory;
    // ??????path??????????????????????????????????????????????????????????????????????????????uri???????????????
    if (uri.isEqual((this.treeModel.root as Directory).uri)) {
      // ???????????????????????????, ??????????????????????????????
      targetNode = await this.fileTreeService.getNodeByPathOrUri(uri)!;
    } else if (this.focusedFile) {
      targetNode = this.focusedFile;
    } else if (this.contextMenuFile) {
      targetNode = this.contextMenuFile;
    } else if (this.selectedFiles.length > 0) {
      const selectedNode = this.selectedFiles[this.selectedFiles.length - 1];
      if (!this.treeModel.root.isItemVisibleAtSurface(selectedNode)) {
        const targetNodePath = await this.fileTreeService.getFileTreeNodePathByUri(uri);
        targetNode = (await this.treeModel.root.loadTreeNodeByPath(targetNodePath!)) as File;
      } else {
        targetNode = selectedNode;
      }
    } else {
      targetNode = await this.fileTreeService.getNodeByPathOrUri(uri)!;
    }
    if (!targetNode) {
      targetNode = this.treeModel.root as Directory;
    }
    const namePieces = Path.splitPath(targetNode.name);
    if (Directory.isRoot(targetNode)) {
      return targetNode;
    } else if (
      targetNode.name !== uri.displayName &&
      namePieces[namePieces.length - 1] !== uri.displayName &&
      isCreatingFile
    ) {
      // ???????????????????????????????????????????????????????????????????????? ??? a/b ????????? a ?????????????????????
      const removePathName = uri.relative(targetNode.uri)!.toString();
      const relativeName = targetNode.name.replace(`${Path.separator}${removePathName}`, '');
      const newTargetUri = (targetNode.parent as Directory).uri.resolve(relativeName);
      const tempFileName = removePathName.split(Path.separator)[0];
      if (!relativeName) {
        return;
      }
      // ???????????????????????????
      if ((targetNode as Directory).children) {
        for (const node of (targetNode as Directory).children!) {
          this.fileTreeService.deleteAffectedNodeByPath(node.path, true);
        }
      }
      // ????????????????????????
      (targetNode as Directory).updateMetaData({
        name: relativeName?.toString(),
        uri: newTargetUri,
        tooltip: this.fileTreeAPI.getReadableTooltip(newTargetUri),
        fileStat: {
          ...targetNode.filestat,
          uri: newTargetUri.toString(),
        },
      });
      this.fileTreeService.addNode(targetNode as Directory, tempFileName, TreeNodeType.CompositeTreeNode);
    }
    return targetNode;
  }

  async newFilePrompt(uri: URI) {
    const targetNode = await this.getPromptTarget(uri, true);
    if (targetNode) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewTreeNode(targetNode as Directory));
    }
  }

  async newDirectoryPrompt(uri: URI) {
    const targetNode = await this.getPromptTarget(uri, true);
    if (targetNode) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewCompositeTreeNode(targetNode as Directory));
    }
  }

  async renamePrompt(uri: URI) {
    const targetNode = await this.getPromptTarget(uri);
    if (targetNode) {
      this.proxyPrompt(await this.fileTreeHandle.promptRename(targetNode, uri.displayName));
    }
  }

  public copyFile = async (from: URI[]) => {
    if (this.pasteStore && this.pasteStore.type === PasteTypes.CUT) {
      this._pasteStore.files.forEach((file) => {
        if (file) {
          this.cutDecoration.removeTarget(file as File);
        }
      });
      this.contextKey?.explorerResourceCut.set(false);
    }
    // ??????????????????
    this.treeModel.dispatchChange();
    const files: (File | Directory)[] = [];
    for (const uri of from) {
      const file = this.fileTreeService.getNodeByPathOrUri(uri);
      if (file) {
        files.push(file);
      }
    }

    this._pasteStore = {
      files: files as (File | Directory)[],
      type: PasteTypes.COPY,
    };
  };

  public pasteFile = async (to: URI) => {
    let parent = this.fileTreeService.getNodeByPathOrUri(to.toString());
    if (!parent || !this.pasteStore) {
      return;
    }
    if (!Directory.is(parent)) {
      parent = parent.parent as Directory;
    }
    let useRefresh = false;
    if (this.fileTreeService.isCompactMode && !parent.uri.isEqual(to)) {
      // ????????????????????????????????????????????????????????????
      useRefresh = true;
    }
    if (this.pasteStore.type === PasteTypes.CUT) {
      for (const file of this.pasteStore.files) {
        if (file) {
          this.cutDecoration.removeTarget(file);
        }
        if (!(parent as Directory).expanded) {
          await (parent as Directory).setExpanded(true);
        }
      }
      const errors = await this.fileTreeAPI.mvFiles(
        this.pasteStore.files.map((file) => file.uri),
        parent.uri,
      );
      if (errors && errors.length > 0) {
        errors.forEach((error) => {
          this.messageService.error(error);
        });
        this.fileTreeService.refresh();
      }
      this.contextKey?.explorerResourceCut.set(false);
      // ????????????
      this.treeModel.dispatchChange();
      this._pasteStore = {
        files: [],
        type: PasteTypes.NONE,
      };
    } else if (this.pasteStore.type === PasteTypes.COPY) {
      for (const file of this.pasteStore.files) {
        const newUri = parent.uri.resolve(file.uri.displayName);
        if (!(parent as Directory).expanded) {
          await (parent as Directory).setExpanded(true);
        }
        const res = await this.fileTreeAPI.copyFile(file.uri, newUri);
        if (useRefresh) {
          this.fileTreeService.refresh(parent.parent as Directory);
        } else if (res) {
          if ((res as FileStat).uri) {
            const copyUri = new URI((res as FileStat).uri);
            this.fileTreeService.addNode(
              parent as Directory,
              copyUri.displayName,
              Directory.is(file) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode,
            );
          } else {
            this.messageService.error(res);
          }
        }
      }
    }
  };

  public cutFile = async (from: URI[]) => {
    if (from.length > 0) {
      this.contextKey?.explorerResourceCut.set(true);
    }
    // ???????????????????????????
    if (this._pasteStore && this._pasteStore.type === PasteTypes.CUT) {
      this._pasteStore.files.forEach((file) => {
        this.cutDecoration.removeTarget(file);
      });
    }
    const files: (File | Directory)[] = [];
    for (const uri of from) {
      const file = this.fileTreeService.getNodeByPathOrUri(uri);
      if (file) {
        files.push(file);
      }
    }
    this._pasteStore = {
      files,
      type: PasteTypes.CUT,
    };

    for (const file of files) {
      if (file) {
        this.cutDecoration.addTarget(file);
      }
    }
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  public location = async (pathOrUri: URI | string) => {
    await this.whenReady;
    // ??????????????????????????????????????????
    if (this.fileTreeService.filterMode) {
      return;
    }
    this._fileToLocation = pathOrUri;

    return this.locationThrottler.queue(this.doLocation);
  };

  private doLocation = async () => {
    if (!this._fileToLocation) {
      return;
    }
    const pathOrUri = this._fileToLocation;
    let path;
    if (typeof pathOrUri === 'string') {
      path = pathOrUri;
    } else {
      path = await this.fileTreeService.getFileTreeNodePathByUri(pathOrUri)!;
    }

    if (path) {
      if (!this.fileTreeHandle) {
        return;
      }
      const node = (await this.fileTreeHandle.ensureVisible(path, 'smart', true)) as File;
      if (node) {
        this.selectFileDecoration(node);
      }
    }
    this._fileToLocation = undefined;
  };

  public locationOnShow = (uri: URI) => {
    this._nextLocationTarget = uri;
  };

  public performLocationOnHandleShow = async () => {
    if (this._nextLocationTarget) {
      await this.location(this._nextLocationTarget);
      this._nextLocationTarget = undefined;
    }
  };
  selectChildNode(uris: URI[]) {
    for (const uri of uris) {
      const file = this.fileTreeService.getNodeByPathOrUri(uri);

      if (file) {
        const children = Directory.isRoot(file) ? (file as Directory).children : file.parent?.children;

        if (children) {
          const first = children[0];
          const last = children[children.length - 1];
          const firstIndex = this.treeModel.root.getIndexAtTreeNode(first);
          const lastIndex = this.treeModel.root.getIndexAtTreeNode(last);

          this.activeFileDecorationByRange(firstIndex, lastIndex);
        }
      }
    }
  }
  dispose() {
    this._isDisposed = true;
  }
}
