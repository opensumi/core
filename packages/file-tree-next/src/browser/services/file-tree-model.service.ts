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
  trim,
  rtrim,
  localize,
  coalesce,
  formatLocalize,
  isValidBasename,
  DisposableCollection,
  StorageProvider,
  STORAGE_NAMESPACE,
  IStorage,
  Event,
  ThrottledDelayer,
  Emitter,
  Deferred,
  OS,
  IApplicationService,
} from '@opensumi/ide-core-browser';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileStat, FileChangeType } from '@opensumi/ide-file-service';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';


import { IFileTreeAPI, IFileTreeService, PasteTypes } from '../../common';
import { Directory, File } from '../../common/file-tree-node.define';
import { FileTreeModel } from '../file-tree-model';
import { FILE_TREE_NODE_HEIGHT } from '../file-tree-node';
import styles from '../file-tree-node.module.less';
import { FileTreeService } from '../file-tree.service';

import { DragAndDropService } from './file-tree-dnd.service';

export interface IParseStore {
  files: (File | Directory)[];
  type: PasteTypes;
}

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

  private _isDisposed = false;

  private _treeModel: FileTreeModel;
  private _dndService: DragAndDropService;

  private _whenReady: Deferred<void> = new Deferred();

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  private cutDecoration: Decoration = new Decoration(styles.mod_cut); // 剪切态
  // 即使选中态也是焦点态的节点，全局仅会有一个
  private _focusedFile: File | Directory | undefined;
  // 选中态的节点，会可能有多个
  private _selectedFiles: (File | Directory)[] = [];
  // 右键菜单选择的节点
  private _contextMenuFile: File | Directory | undefined;

  // 当前焦点的文件路径URI
  private _activeUri: URI | null;

  private _nextLocationTarget: URI | undefined;

  // 右键菜单ContextKey，相对独立
  private _currentRelativeUriContextKey: IContextKey<string>;
  private _currentContextUriContextKey: IContextKey<string>;
  private _contextMenuResourceContext: ResourceContextKey;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private validateMessage: FileTreeValidateMessage | undefined;
  private _pasteStore: IParseStore;
  private _isMutiSelected = false;

  private _loadSnapshotReady: Promise<void>;

  private _explorerStorage: IStorage;

  private locationDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_LOCATION_FLUSH_DELAY);
  private refreshedActionDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_REFRESHED_ACTION_DELAY);
  private labelChangedDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_LABEL_CHANGED_DELAY);
  private onDidFocusedFileChangeEmitter: Emitter<URI | undefined> = new Emitter();
  private onDidContextMenuFileChangeEmitter: Emitter<URI | undefined> = new Emitter();
  private onDidSelectedFileChangeEmitter: Emitter<URI[]> = new Emitter();
  private onFileTreeModelChangeEmitter: Emitter<TreeModel> = new Emitter();

  private locationQueueDeferred: Deferred<void> | null = new Deferred<void>();
  private isPatchingLocation = false;
  private _locationDispatchQueue: (URI | string)[] = [];

  private treeStateWatcher: TreeStateWatcher;
  private willSelectedNodePath: string | null;

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

  get loadSnapshotReady() {
    return this._loadSnapshotReady;
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

  // 既是选中态，也是焦点态节点
  get focusedFile() {
    return this._focusedFile;
  }

  set focusedFile(value: File | Directory | undefined) {
    this.onDidFocusedFileChangeEmitter.fire(value ? value.uri : undefined);
    this._focusedFile = value;
  }

  // 右键菜单选中的节点
  get contextMenuFile() {
    return this._contextMenuFile;
  }

  set contextMenuFile(value: File | Directory | undefined) {
    this.onDidContextMenuFileChangeEmitter.fire(value ? value.uri : undefined);
    this._contextMenuFile = value;
  }

  // 是选中态，非焦点态节点
  get selectedFiles() {
    return this._selectedFiles;
  }

  set selectedFiles(value: (File | Directory)[]) {
    this.onDidSelectedFileChangeEmitter.fire(value ? value.map((v) => v.uri) : []);
    this._selectedFiles = value;
  }

  // 获取当前激活的文件URI，仅在压缩目录模式下可用
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

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = (await this.fileTreeService.resolveChildren())[0];
    if (!root) {
      this._whenReady.resolve();
      return;
    }
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
    this._explorerStorage = await this.storageProvider(STORAGE_NAMESPACE.EXPLORER);
    // 获取上次文件树的状态
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      // 初始化时。以右侧编辑器打开的文件进行定位
      this._loadSnapshotReady = this.loadFileTreeSnapshot(snapshot);
    }
    this.initDecorations(root);
    // _dndService依赖装饰器逻辑加载
    this._dndService = this.injector.get<any>(DragAndDropService, [this]);
    // 确保文件树响应刷新操作时无正在操作的 CollapsedAll 和 Location
    this.disposableCollection.push(
      this.fileTreeService.requestFlushEventSignalEvent(async () => await this.canHandleRefreshEvent()),
    );
    // 等待初次加载完成后再初始化当前的 treeStateWatcher, 只加载可见的节点
    this.treeStateWatcher = this._treeModel.getTreeStateWatcher(true);
    this.disposableCollection.push(
      this.treeStateWatcher.onDidChange(() => {
        const snapshot = this.explorerStorage.get<any>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
        const currentTreeSnapshot = this.treeStateWatcher.snapshot();
        this.explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, {
          ...snapshot,
          ...currentTreeSnapshot,
        });
      }),
    );
    this.disposableCollection.push(
      this.fileTreeService.onNodeRefreshed((node) => {
        if (!this.refreshedActionDelayer.isTriggered) {
          this.refreshedActionDelayer.cancel();
        }
        this.refreshedActionDelayer.trigger(async () => {
          // 当无选中节点时，选中编辑器中激活的节点
          if (Directory.isRoot(node) && this.selectedFiles.length === 0) {
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
        // 更新树前更新下选中节点
        if (this.willSelectedNodePath) {
          const node = this.fileTreeService.getNodeByPathOrUri(this.willSelectedNodePath);
          if (node) {
            this.selectFileDecoration(node, false);
            this.willSelectedNodePath = null;
          }
        } else if (this.contextMenuFile) {
          const node = this.treeModel?.root.getTreeNodeByPath(this.contextMenuFile.path);
          if (node) {
            this.selectFileDecoration(node as File, false);
          }
        } else if (this.focusedFile) {
          const node = this.treeModel?.root.getTreeNodeByPath(this.focusedFile.path);
          if (node) {
            this.activeFileDecoration(node as File, false);
          }
        } else if (this.selectedFiles.length !== 0) {
          // 仅处理一下单选情况
          const node = this.treeModel?.root.getTreeNodeByPath(this.selectedFiles[0].path);
          if (node) {
            this.selectFileDecoration(node as File, false);
          }
        }
      }),
    );
    // 当labelService注册的对应节点图标变化时，通知视图更新
    this.disposableCollection.push(
      this.labelService.onDidChange(async () => {
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
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
      }),
    );
    await this.loadSnapshotReady;
    // 先加载快照后再监听文件变化，同时操作会出现Tree更新后节点无法对齐问题
    // 即找到插入节点位置为 0，导致重复问题
    this.fileTreeService.startWatchFileEvent();
    this.onFileTreeModelChangeEmitter.fire(this._treeModel);

    this._whenReady.resolve();
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
   * 多选情况下，焦点节点只要一个，选中节点有多个
   * 单选情况下，焦点节点与选中节点均只有一个
   * 在文件树空白区域右键时，焦点元素为根节点
   * @param node 焦点节点
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
    if (this.loadSnapshotReady) {
      await this.loadSnapshotReady;
    }
    if (this.locationQueueDeferred) {
      await this.locationQueueDeferred.promise;
    }
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  };

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (this.contextMenuFile) {
      this.contextMenuDecoration.removeTarget(this.contextMenuFile);
      this.contextMenuFile = undefined;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        // 因为选择装饰器可能通过其他方式添加而不能及时在selectedFiles上更新
        // 故这里遍历所有选中装饰器的节点进行一次统一清理
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
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectFileDecoration = (target: File | Directory, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
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
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // 右键菜单焦点态切换
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

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeFileFocusedDecoration = (target: File | Directory, removePreFocusedDecoration = false) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        if (this.focusedFile) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this.contextMenuFile = target;
      } else if (this.focusedFile) {
        this.contextMenuFile = undefined;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        // 存在多选文件时切换焦点的情况
        if (this._selectedFiles.indexOf(target) < 0) {
          this.selectedDecoration.addTarget(target);
          this._selectedFiles.push(target);
          this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
        }
        this.focusedDecoration.addTarget(target);
        this.focusedFile = target;
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 判断节点是否选中，进行状态反转
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
    // 选中状态变化
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 选中范围内的所有节点
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
    // 选中状态变化
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 取消选中节点焦点
  deactivateFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.focusedFile = undefined;
    }
    // 失去焦点状态时，仅清理右键菜单的选中态
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

  removeFileDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, file?: File | Directory, activeUri?: URI) => {
    ev.stopPropagation();
    ev.preventDefault();

    let nodes: (File | Directory)[];
    let node: File | Directory;

    if (!file) {
      // 空白区域右键菜单
      nodes = [this.treeModel.root as Directory];
      node = this.treeModel.root as Directory;
    } else {
      node = file;
      if (this._isMutiSelected) {
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

    // 这里是一些额外的 contextKey 的判断，补充一下上面的逻辑
    if (this.fileTreeService.isCompactMode && activeUri) {
      this._activeUri = activeUri;
      // 存在 activeUri 的情况默认 explorerResourceIsFolder 的值都为 true
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

    // 更新压缩节点对应的Contextkey
    this.setExplorerCompressedContextKey(node, activeUri);

    const { x, y } = ev.nativeEvent;

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: activeUri ? [activeUri, [activeUri]] : [node.uri, nodes.map((node) => node.uri)],
    });
  };

  setExplorerCompressedContextKey(node?: File | Directory, activeUri?: URI) {
    if (node && activeUri) {
      this.contextKey?.explorerCompressedFocusContext.set(true);
      const compressedNamePath = new Path(node.name);
      if (compressedNamePath.name === activeUri.displayName) {
        // 压缩节点末尾位置选中
        this.contextKey?.explorerCompressedLastFocusContext.set(true);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      } else if (compressedNamePath.root && compressedNamePath.root.name === activeUri.displayName) {
        // 压缩节点开头位置选中
        this.contextKey?.explorerCompressedLastFocusContext.set(false);
        this.contextKey?.explorerCompressedFirstFocusContext.set(true);
      } else {
        // 压缩节点中间位置选中
        this.contextKey?.explorerCompressedLastFocusContext.set(false);
        this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      }
    } else if (node) {
      // 默认情况下，如果一个节点为压缩节点，末尾位置选中
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
    // file-tree 组件销毁会触发 handleTreeBlue，此时 fileTreeContextKey 可能还没初始化，但其它的 service 已经 dispose 了
    if (this._isDisposed) {
      return;
    }
    this.contextKey?.filesExplorerFocused.set(false);
    // 失去焦点状态时，清理右键菜单的选中态
    // 清空焦点状态
    this.deactivateFileDecoration();
    // 失去焦点默认 explorerResourceIsFolder 的值都为 false
    this.contextKey?.explorerResourceIsFolder.set(false);
  };

  handleTreeFocus = () => {
    // 激活面板
    this.contextKey?.filesExplorerFocused.set(true);
  };

  handleItemRangeClick = (item: File | Directory, type: TreeNodeType) => {
    if (!this.focusedFile) {
      this.handleItemClick(item, type);
    } else if (this.focusedFile && this.focusedFile !== item) {
      this._isMutiSelected = true;
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
    this._isMutiSelected = true;
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }

    // 根据节点的选中态进行复选操作
    this.toggleFileSelectedDecoration(item);
  };

  /**
   * 当传入的 `item` 为 `undefined` 时，默认为目录类型的选择
   * 工作区模式下 `type` 为 `TreeNodeType.TreeNode`
   * 目录模式下 `type` 为 `TreeNodeType.CompositeTreeNode`
   *
   * @param item 节点
   * @param type 节点类型
   * @param activeUri 焦点路径
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
    // 更新压缩节点对应的Contextkey
    this.setExplorerCompressedContextKey(item, activeUri);

    this._isMutiSelected = false;
    if (this.fileTreeService.isCompactMode && activeUri) {
      this._activeUri = activeUri;
      // 存在 activeUri 的情况默认 explorerResourceIsFolder 的值都为 true
      this.contextKey?.explorerResourceIsFolder.set(true);
    } else if (!activeUri) {
      this._activeUri = null;
      // 单选操作默认先更新选中状态
      if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
        this.activeFileDecoration(item);
      }
      this.contextKey?.explorerResourceIsFolder.set(type === TreeNodeType.CompositeTreeNode);
    }

    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
      if (type === TreeNodeType.CompositeTreeNode) {
        this.contextKey?.explorerResourceIsFolder.set(true);
        this.toggleDirectory(item as Directory);
      } else if (type === TreeNodeType.TreeNode) {
        this.contextKey?.explorerResourceIsFolder.set(false);
        // 对于文件的单击事件，走 openFile 去执行 editor.previewMode 配置项
        this.fileTreeService.openFile(item.uri);
      }
    }
  };

  handleItemDoubleClick = (item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
    // 双击事件触发前，会先触发 handleItemClick 方法装饰文件
    if (type === TreeNodeType.TreeNode) {
      // 双击的时候，不管 workbench.list.openMode 为单击还是双击，都以非预览模式打开文件
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
      // 当前没有焦点文件时，执行无效果
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
    this.activateFileActivedDecoration(nextFileNode as File);
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
      // 当前没有焦点文件时，执行无效果
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
    this.activateFileActivedDecoration(prevFileNode as File);
    if ((snapshot.scrollPosition || 0) > offsetHeight) {
      this.fileTreeHandle.ensureVisible(prevFileNode as File, 'start');
    }
  }

  public async collapseCurrentFile() {
    let node;
    if (this.focusedFile) {
      node = this.focusedFile;
    } else if (this.contextMenuFile) {
      node = this.contextMenuFile;
    }
    let target: Directory;
    if (Directory.is(node) && node.expanded) {
      target = node as Directory;
    } else if (node) {
      target = node.parent as Directory;
    } else {
      return;
    }
    if (target && target.expanded) {
      await this.fileTreeHandle.collapseNode(target as Directory);
      this.activeFileFocusedDecoration(target as Directory, true);
    }
  }

  public async expandCurrentFile() {
    let node;
    if (this.focusedFile) {
      node = this.focusedFile;
    } else if (this.contextMenuFile) {
      node = this.contextMenuFile;
    }
    if (Directory.is(node)) {
      if (!node.expanded) {
        await this.fileTreeHandle.expandNode(node as Directory);
      }
    }
  }

  // 命令调用
  async collapseAll() {
    await this.treeModel.root.collapsedAll();
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      // 折叠全部后确保将所有目录状态更新，防止立即刷新时状态异常
      this.explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, {
        ...snapshot,
        expandedDirectories: {
          atSurface: [],
          buried: [],
        },
      });
    }
  }

  // 展开所有缓存目录
  public expandAllCacheDirectory = async () => {
    const size = this.treeModel.root.branchSize;
    for (let index = 0; index < size; index++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(index) as Directory;
      if (Directory.is(file) && !file.expanded && file.branchSize > 0) {
        await file.setExpanded();
      }
    }
  };

  async deleteFileByUris(uris: URI[]) {
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
    let preUri: URI;
    for (const uri of uris) {
      const effectNode = this.fileTreeService.getNodeByPathOrUri(uri);
      this.loadingDecoration.addTarget(effectNode!);
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
    // 移除文件
    for (const uri of uris) {
      if (!!preUri! && preUri!.isEqualOrParent(uri)) {
        // 当下个删除文件为上个删除文件的子文件时，只需要忽略即可
        continue;
      }
      await this.deleteFile(uri);
      preUri = uri;
    }
  }

  async deleteFile(uri: URI) {
    // 提前缓存文件路径
    let targetPath: string | URI | undefined;
    // 当存在activeUri时，即存在压缩目录的子路径被删除
    if (this.activeUri) {
      targetPath = uri;
    } else if (this.focusedFile) {
      // 使用path能更精确的定位新建文件位置，因为软连接情况下可能存在uri一致的情况
      targetPath = this.focusedFile.path;
    } else if (this.selectedFiles.length > 0) {
      targetPath = this.selectedFiles[this.selectedFiles.length - 1].path;
    } else {
      targetPath = uri;
    }
    const error = await this.fileTreeAPI.delete(uri);
    if (error) {
      this.messageService.error(error);
      return false;
    }
    const effectNode = this.fileTreeService.getNodeByPathOrUri(targetPath);
    if (effectNode && effectNode.uri.isEqual(uri)) {
      this.fileTreeService.deleteAffectedNodeByPath(effectNode.path);
    } else if (effectNode) {
      // 清空节点路径焦点态
      this.contextKey?.explorerCompressedFocusContext.set(false);
      this.contextKey?.explorerCompressedFirstFocusContext.set(false);
      this.contextKey?.explorerCompressedLastFocusContext.set(false);
      // 说明是异常情况或子路径删除
      this.fileTreeService.refresh((effectNode as File).parent as Directory);
    }
    this.loadingDecoration.removeTarget(effectNode!);
    return true;
  }

  private getWellFormedFileName(filename: string): string {
    if (!filename) {
      return filename;
    }

    // 去除空格
    filename = trim(filename, '\t');

    // 移除尾部的 . / \\
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
    // 转换为合适的名称
    name = this.getWellFormedFileName(name);

    // 不存在文件名称
    if (!name || name.length === 0 || /^\s+$/.test(name)) {
      return {
        message: localize('validate.tree.emptyFileNameError'),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    // 不允许开头为分隔符的名称
    if (name[0] === '/' || name[0] === '\\') {
      return {
        message: localize('validate.tree.fileNameStartsWithSlashError'),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    // 当文件名称前后有空格时，提示用户
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

    // 压缩目录重命名的情况下不需要判断同名文件
    if (parent) {
      const isCompactNodeRenamed =
        promptHandle instanceof RenamePromptHandle &&
        (promptHandle.target as File).displayName.indexOf(Path.separator) > 0;
      if (!isCompactNodeRenamed) {
        // 不允许覆盖已存在的文件
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
    // 判断子路径是否合法
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
      // 文件树更新后尝试定位文件位置
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
        // 无变化，直接返回
        if ((isCompactNode && this.activeUri?.displayName === newName) || (!isCompactNode && newName === target.name)) {
          return true;
        }
        promptHandle.addAddonAfter('loading_indicator');
        if (isCompactNode && newNameFragments.length > 0) {
          // 压缩目录情况下，需要计算下标进行重命名路径拼接
          from = (target.parent as Directory).uri.resolve(nameFragments.slice(0, index + 1).join(Path.separator));
          to = (target.parent as Directory).uri.resolve(newNameFragments.concat().join(Path.separator));
        }
        // 屏蔽重命名文件事件
        this.fileTreeService.ignoreFileEventOnce((target.parent as Directory).uri);
        const error = await this.fileTreeAPI.mv(from, to, target.type === TreeNodeType.CompositeTreeNode);
        if (error) {
          this.fileTreeService.ignoreFileEventOnce(null);
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        if (!isCompactNode) {
          // 重命名节点的情况，直接刷新一下父节点即可
          const newPath = new Path(target.parent!.path).join(newName).toString();
          await this.fileTreeService.refresh(target.parent as Directory);
          this.willSelectedNodePath = newPath;
        } else {
          // 更新压缩目录展示名称
          target.updateDisplayName(newNameFragments.concat(nameFragments.slice(index + 1)).join(Path.separator));
          target.updateName(newNameFragments.concat(nameFragments.slice(index + 1)).join(Path.separator));
          // 由于节点移动时默认仅更新节点路径
          // 我们需要自己更新额外的参数，如uri, filestat等
          target.updateURI(to);
          target.updateFileStat({
            ...target.filestat,
            uri: to.toString(),
          });
          target.updateToolTip(this.fileTreeAPI.getReadableTooltip(to));
          this.treeModel.dispatchChange();
          if ((target.parent as Directory).children?.find((child) => target.path.indexOf(child.path) >= 0)) {
            // 当重命名后的压缩节点在父节点中存在子集节点时，刷新父节点
            // 如：
            // 压缩节点 001/002 修改为 003/002 时
            // 同时父节点下存在 003 空节点
            await this.fileTreeService.refresh(target.parent as Directory);
          } else {
            // 压缩节点重命名时，刷新文件夹更新子文件路径
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
          if (this.fileTreeService.isCompactMode && isEmptyDirectory && !Directory.isRoot(parent)) {
            this.fileTreeService.ignoreFileEvent(parent.uri, FileChangeType.UPDATED);
            if ((await this.appService.backendOS) === OS.Type.Windows) {
              // Windows环境下会多触发一个UPDATED事件
              this.fileTreeService.ignoreFileEvent(parent.uri.resolve(newName), FileChangeType.UPDATED);
            }
            this.fileTreeService.ignoreFileEvent(parent.uri.resolve(newName), FileChangeType.ADDED);
          }
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
          // 压缩模式下，检查是否有同名父目录存在，有则不需要生成临时目录，刷新对应父节点并定位节点
          const parentPath = new Path(parent.path).join(Path.splitPath(newName)[0]).toString();
          const parentNode = this.fileTreeService.getNodeByPathOrUri(parentPath) as Directory;
          if (parentNode) {
            if (!parentNode.expanded && !parentNode.children) {
              await parentNode.setExpanded(true);
              // 使用uri作为定位是不可靠的，需要检查一下该节点是否处于软链接目录内进行对应转换
              selectNodeIfNodeExist(new Path(parent.path).join(newName).toString());
            } else {
              await this.fileTreeService.refresh(parentNode as Directory);
              selectNodeIfNodeExist(new Path(parent.path).join(newName).toString());
            }
          } else {
            // 不存在同名目录的情况下
            if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
              if (isEmptyDirectory) {
                const prePath = parent.path;
                // Re-cache TreeNode
                this.fileTreeService.removeNodeCacheByPath(prePath);
                const newNodeName = [parent.name].concat(newName).join(Path.separator);
                parent.updateName(newNodeName);
                parent.updateDisplayName(newNodeName);
                parent.updateURI(parent.uri.resolve(newName));
                parent.updateFileStat({
                  ...parent.filestat,
                  uri: parent.uri.resolve(newName).toString(),
                });
                parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parent.uri.resolve(newName)));
                // Re-cache TreeNode
                this.fileTreeService.reCacheNode(parent, prePath);
                selectNodeIfNodeExist(parent.path);
              } else {
                const addNode = await this.fileTreeService.addNode(parent, newName, promptHandle.type);
                // 文件夹首次创建需要将焦点设到新建的文件夹上
                selectNodeIfNodeExist(addNode.path);
              }
            } else if (promptHandle.type === TreeNodeType.TreeNode) {
              const namePieces = Path.splitPath(newName);
              const parentAddonPath = namePieces.slice(0, namePieces.length - 1).join(Path.separator);
              const fileName = namePieces.slice(-1)[0];
              const prePath = parent.path;
              // Remove TreeNode Cache
              this.fileTreeService.removeNodeCacheByPath(prePath);
              const parentUri = parent.uri.resolve(parentAddonPath);
              const newNodeName = [parent.name].concat(parentAddonPath).join(Path.separator);
              parent.updateDisplayName(newNodeName);
              parent.updateName(newNodeName);
              parent.updateURI(parentUri);
              parent.updateFileStat({
                ...parent.filestat,
                uri: parentUri.toString(),
              });
              parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parentUri));
              // Re-cache TreeNode
              this.fileTreeService.reCacheNode(parent, prePath);

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
            // Remove TreeNode Cache
            const prePath = parent.path;
            this.fileTreeService.removeNodeCacheByPath(prePath);
            const parentUri = parent.uri.resolve(newName);
            const newNodeName = [parent.name].concat(newName).join(Path.separator);
            parent.updateName(newNodeName);
            parent.updateDisplayName(newNodeName);
            parent.updateURI(parentUri);
            parent.updateFileStat({
              ...parent.filestat,
              uri: parentUri.toString(),
            });
            parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parentUri));
            // Re-cache TreeNode
            this.fileTreeService.reCacheNode(parent, prePath);
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
        // 清空节点路径焦点态
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
      // 返回true时，输入框会隐藏
      return true;
    };
    const handleFocus = async () => {
      this.contextKey?.filesExplorerInputFocused.set(true);
    };
    const handleDestroy = () => {
      if (this.contextMenuFile) {
        // 卸载输入框时及时更新选中态
        this.selectFileDecoration(this.contextMenuFile, true);
      }
    };
    const handleCancel = () => {
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
    // 文件树刷新操作会让重命名/新建输入框销毁
    // 可能存在部分用户疑惑
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
    // 使用path能更精确的定位新建文件位置，因为软连接情况下可能存在uri一致的情况
    if (uri.isEqual((this.treeModel.root as Directory).uri)) {
      // 可能为空白区域点击, 即选中的对象为根目录
      targetNode = await this.fileTreeService.getNodeByPathOrUri(uri)!;
    } else if (this.contextMenuFile) {
      targetNode = this.contextMenuFile;
    } else if (this.selectedFiles.length > 0) {
      const selectedNode = this.selectedFiles[this.selectedFiles.length - 1];
      if (!this.treeModel.root.isItemVisibleAtSurface(selectedNode)) {
        const targetNodePath = await this.fileTreeService.getFileTreeNodePathByUri(uri);
        targetNode = (await this.treeModel.root.forceLoadTreeNodeAtPath(targetNodePath!)) as File;
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
      // 说明当前在压缩节点的非末尾路径上触发的新建事件， 如 a/b 上右键 a 产生的新建事件
      const removePathName = uri.relative(targetNode.uri)!.toString();
      const relativeName = targetNode.name.replace(`${Path.separator}${removePathName}`, '');
      const newTargetUri = (targetNode.parent as Directory).uri.resolve(relativeName);
      const tempFileName = removePathName.split(Path.separator)[0];
      if (!relativeName) {
        return;
      }
      const prePath = targetNode.path;
      // Re-cache TreeNode
      this.fileTreeService.removeNodeCacheByPath(prePath);
      // 移除目录下的子节点
      if ((targetNode as Directory).children) {
        for (const node of (targetNode as Directory).children!) {
          this.fileTreeService.deleteAffectedNodeByPath(node.path, true);
        }
      }
      // 更新目标节点信息
      targetNode.updateName(relativeName!.toString());
      targetNode.updateDisplayName(relativeName!.toString());
      targetNode.updateURI(newTargetUri);
      targetNode.updateToolTip(this.fileTreeAPI.getReadableTooltip(newTargetUri));
      targetNode.updateFileStat({
        ...targetNode.filestat,
        uri: newTargetUri.toString(),
      });
      this.fileTreeService.reCacheNode(targetNode, prePath);
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
    // 通知视图更新
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
      // 压缩路径的粘贴操作，使用刷新操作进行更新
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
      // 更新视图
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
    // 清理上一次剪切文件
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
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  public location = async (pathOrUri: URI | string) => {
    // 筛选模式下，禁止使用定位功能
    if (this.fileTreeService.filterMode) {
      return;
    }
    // 当存在等待选中的节点路径时，跳过定位
    if (this.willSelectedNodePath) {
      return;
    }

    return this.queueLocation(pathOrUri);
  };

  private queueLocation(path: URI | string) {
    if (!this.isPatchingLocation) {
      if (!this.locationDelayer.isTriggered) {
        this.locationDelayer.cancel();
      }
      this.locationDelayer.trigger(async () => {
        this.isPatchingLocation = true;
        if (!this.locationQueueDeferred) {
          this.locationQueueDeferred = new Deferred<void>();
        }
        if (this.loadSnapshotReady) {
          await this.loadSnapshotReady;
        }
        // 每次触发定位操作前均等待一下前序的文件树刷新任务
        await this.fileTreeService.willRefreshPromise;

        await this.doLocation();
        this.locationQueueDeferred?.resolve();
        this.locationQueueDeferred = null;
        this.isPatchingLocation = false;
      });
    }
    if (this._locationDispatchQueue.indexOf(path) === -1) {
      this._locationDispatchQueue.push(path);
    }
  }

  private async doLocation() {
    if (!this._locationDispatchQueue || this._locationDispatchQueue.length === 0) {
      return;
    }
    // 只需要处理最后一个定位节点
    const pathOrUri = this._locationDispatchQueue[this._locationDispatchQueue.length - 1];
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
    this._locationDispatchQueue = [];
  }

  public locationOnShow = (uri: URI) => {
    this._nextLocationTarget = uri;
  };

  public performLocationOnHandleShow = async () => {
    if (this._nextLocationTarget) {
      await this.location(this._nextLocationTarget);
      this._nextLocationTarget = undefined;
    }
  };

  dispose() {
    this._isDisposed = true;
  }
}
