import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel, DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, RenamePromptHandle, NewPromptHandle, PromptValidateMessage, PROMPT_VALIDATE_TYPE, TreeNodeEvent } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel } from '../file-tree-model';
import { File, Directory } from '../file-tree-nodes';
import { CorePreferences, IContextKey, URI, trim, rtrim, localize, coalesce, formatLocalize, isValidBasename, DisposableCollection, StorageProvider, STORAGE_NAMESPACE, IStorage, Event } from '@ali/ide-core-browser';
import { FileContextKey } from '../file-contextkey';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Path } from '@ali/ide-core-common/lib/path';
import { IFileTreeAPI, PasteTypes } from '../../common';
import { DragAndDropService } from './file-tree-dnd.service';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import * as styles from '../file-tree-node.module.less';
import { FileStat } from '@ali/ide-file-service';

export interface IParseStore {
  files: (File|Directory)[];
  type: PasteTypes;
}

export interface IFileTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export interface FileTreeValidateMessage extends PromptValidateMessage {
  value: string;
}

@Injectable()
export class FileTreeModelService {

  static FILE_TREE_SNAPSHOT_KEY = 'FILE_TREE_SNAPSHOT';

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(FileTreeService)
  private readonly fileTreeService: FileTreeService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

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

  @Autowired(FileContextKey)
  private readonly fileTreeContextKey: FileContextKey;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  private _treeModel: TreeModel;
  private _dndService: DragAndDropService;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 焦点态
  private cutDecoration: Decoration = new Decoration(styles.mod_cut); // 焦点态
  // 即使选中态也是焦点态的节点，全局仅会有一个
  private _focusedFile: File | Directory | undefined;
  // 选中态的节点，会可能有多个
  private _selectedFiles: (File | Directory)[] = [];

  private clickTimes: number;
  private clickTimer: any;
  private preContextMenuFocusedFile: File | Directory | null;
  private _nextLocationTarget: URI | undefined;

  // 右键菜单ContextKey，相对独立
  // TODO：后续需支持通过DOM获取context，这样无需耦合contextMenuService
  private _currentRelativeUriContextKey: IContextKey<string>;
  private _currentContextUriContextKey: IContextKey<string>;
  private _contextMenuResourceContext: ResourceContextKey;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private validateMessage: FileTreeValidateMessage | undefined;
  private _pasteStore: IParseStore;

  constructor() {
    this._whenReady = this.initTreeModel();
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
    return this._whenReady;
  }

  // 既是选中态，也是焦点态节点
  get focusedFile() {
    return this._focusedFile;
  }
  // 是选中态，非焦点态节点
  get selectedFiles() {
    return this._selectedFiles;
  }
  get pasteStore() {
    return this._pasteStore;
  }

  get currentRelativeUriContextKey(): IContextKey<string> {
    if (!this._currentRelativeUriContextKey) {
      this._currentRelativeUriContextKey = this.fileTreeService.contextMenuContextKeyService.createKey('filetreeContextRelativeUri', '');
    }
    return this._currentRelativeUriContextKey;
  }

  get currentContextUriContextKey(): IContextKey<string> {
    if (!this._currentContextUriContextKey) {
      this._currentContextUriContextKey = this.fileTreeService.contextMenuContextKeyService.createKey('filetreeContextUri', '');
    }
    return this._currentContextUriContextKey;
  }

  get contextMenuResourceContext(): ResourceContextKey {
    if (!this._contextMenuResourceContext) {
      this._contextMenuResourceContext = new ResourceContextKey(this.fileTreeService.contextMenuContextKeyService);
    }
    return this._contextMenuResourceContext;
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = (await this.fileTreeService.resolveChildren())[0];
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
    const explorerStorage: IStorage =  await this.storageProvider(STORAGE_NAMESPACE.EXPLORER);
    // 获取上次文件树的状态
    const snapshot = explorerStorage.get(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      this._treeModel.loadTreeState(snapshot);
    }
    this.initDecorations(root);
    // _dndService依赖装饰器逻辑加载
    this._dndService = this.injector.get<any>(DragAndDropService, [this]);
    const treeStateWatcher = this._treeModel.getTreeStateWatcher();
    this.disposableCollection.push(treeStateWatcher.onDidChange(() => {
      explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, treeStateWatcher.snapshot());
    }));
    this.disposableCollection.push(this.fileTreeService.onNodeRefreshed(() => {
      // 尝试恢复树
      const snapshot = explorerStorage.get<any>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
      if (snapshot && snapshot.specVersion) {
        this._treeModel.loadTreeState(snapshot);
      }
    }));
    this.disposableCollection.push(this.labelService.onDidChange(() => {
      // 当labelService注册的对应节点图标变化时，通知视图更新
      this.treeModel.dispatchChange();
    }));
    this.disposableCollection.push(this.treeModel.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
      this.loadingDecoration.addTarget(target);
    }));
    this.disposableCollection.push(this.treeModel.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
      this.loadingDecoration.removeTarget(target);
    }));
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.cutDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  /**
   * 多选情况下，焦点节点只要一个，选中节点有多个
   * 单选情况下，焦点节点与选中节点均只有一个
   * 在文件树空白区域邮件时，焦点元素为根节点
   * @param files 选中节点
   * @param file 焦点节点
   */
  private setFileTreeContextKey(file: Directory | File) {
    const isSingleFolder = !this.fileTreeService.isMutiWorkspace;
    this.fileTreeContextKey.explorerFolder.set((isSingleFolder && !file) || !!file && Directory.is(file));
    this.currentContextUriContextKey.set(file.uri.toString());
    this.currentRelativeUriContextKey.set(((this.treeModel.root as Directory).uri.relative(file.uri) || '').toString());
    this.contextMenuResourceContext.set(file.uri);
  }

  private async getFileTreeNodePathByUri(uri: URI) {
    if (!uri) {
      return;
    }
    const isSingleFolder = !this.fileTreeService.isMutiWorkspace;
    let rootUri;
    if (isSingleFolder) {
      rootUri = this.workspaceService.workspace?.uri;
    } else {
      rootUri = (await this.workspaceService.roots).find((root) => {
        return new URI(root.uri).isEqualOrParent(uri);
      })?.uri;
    }
    if (rootUri && this.treeModel) {
      return new Path(this.treeModel.root.path).join(new URI(rootUri).relative(uri)!.toString()).toString();
    }
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: File | Directory) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }
    // 更新当前焦点context
    this.fileTreeContextKey.filesExplorerFocused.set(true);

    if (this.preContextMenuFocusedFile) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.preContextMenuFocusedFile = null;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.focusedDecoration.removeTarget(file);
          this.selectedDecoration.removeTarget(file);
        });
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedFile = target;
      this._selectedFiles = [target];
      // 通知视图更新
      this.treeModel.dispatchChange();
    }
  }

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeFileFocusedDecoration = (target: File | Directory, removePreFocusedDecoration: boolean = false) => {
    // 激活元素时同时激活面板
    this.fileTreeContextKey.filesExplorerFocused.set(true);

    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
        if (this.preContextMenuFocusedFile) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
        } else if (!!this.focusedFile) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this.preContextMenuFocusedFile = target;
      } else if (!!this.focusedFile) {
        this.preContextMenuFocusedFile = null;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedFile = target;
        this._selectedFiles.push(target);
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 选中当前指定节点，添加装饰器属性
  activeFileSelectedDecoration = (target: File | Directory) => {
    if (this.selectedFiles.indexOf(target) > -1) {
      return ;
    }
    this.selectedFiles.push(target);
    this.selectedDecoration.addTarget(target);
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 选中范围内的所有节点
  activeFileDecorationByRange = (begin: number, end: number) => {
    this.clearFileSelectedDecoration();
    this.preContextMenuFocusedFile = null;
    for (; begin <= end; begin++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (file) {
        this._selectedFiles.push(file as File);
        this.selectedDecoration.addTarget(file);
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 取消选中节点焦点
  enactiveFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.treeModel.dispatchChange();
    }
    this._focusedFile = undefined;
  }

  toggleDirectory = (item: Directory) => {
    if (item.expanded) {
      this.fileTreeHandle.collapseNode(item);
    } else {
      this.fileTreeHandle.expandNode(item);
    }
  }

  removeFileDecoration() {
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, file?: File | Directory) => {
    ev.stopPropagation();

    const { x, y } = ev.nativeEvent;
    if (file) {
      this.activeFileFocusedDecoration(file, true);
    } else {
      this.enactiveFileDecoration();
    }
    let nodes: (File | Directory)[] = this.selectedFiles;
    let node: File | Directory;

    if (!file) {
      // 空白区域右键菜单
      nodes = [this.treeModel.root as Directory];
      node = this.treeModel.root as Directory;
    } else {
      node = file;
    }

    this.setFileTreeContextKey(node);

    const menus = this.contextMenuService.createMenu({
      id: MenuId.ExplorerContext,
      contextKeyService: this.fileTreeService.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [node.uri, nodes.map((node) => node.uri)],
    });
  }

  handleTreeHandler(handle: IFileTreeHandle) {
    this._fileTreeHandle = handle;
  }

  handleTreeBlur = () => {
    this.fileTreeContextKey.filesExplorerFocused.set(false);
    // 情况焦点状态
    this.enactiveFileDecoration();
  }

  handleItemRangeClick = (item: File | Directory, type: TreeNodeType) => {
    if (!this.focusedFile) {
      this.handleItemClick(item, type);
    } else if (this.focusedFile && this.focusedFile !== item) {
      const targetIndex = this.treeModel.root.getIndexAtTreeNode(item);
      const preFocusedFileIndex = this.treeModel.root.getIndexAtTreeNode(this.focusedFile);
      if (preFocusedFileIndex > targetIndex) {
        this.activeFileDecorationByRange(targetIndex, preFocusedFileIndex);
      } else if (preFocusedFileIndex < targetIndex) {
        this.activeFileDecorationByRange(preFocusedFileIndex, targetIndex);
      }
    }
  }

  handleItemToggleClick = (item: File | Directory, type: TreeNodeType) => {
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }
    // 选中的节点不是选中状态时，默认先更新节点为选中状态
    // 后续点击切换焦点状态
    if (this.selectedFiles.indexOf(item) > -1) {
      if (this.focusedFile === item) {
        this.enactiveFileDecoration();
      } else {
        this.activeFileFocusedDecoration(item);
      }
    } else {
      this.activeFileSelectedDecoration(item);
    }
  }

  handleItemClick = (item: File | Directory, type: TreeNodeType) => {
    this.clickTimes++;
    // 单选操作默认先更新选中状态
    if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
      this.activeFileDecoration(item);
    }
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (type === TreeNodeType.CompositeTreeNode) {
      if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
        this.toggleDirectory(item as Directory);
      }
    } else if (type === TreeNodeType.TreeNode) {
      this.fileTreeService.openFile(item.uri);
    }
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      // 单击事件
      // 200ms内多次点击默认为双击事件
      if (this.clickTimes > 1) {
        if (type === TreeNodeType.TreeNode) {
          this.fileTreeService.openAndFixedFile(item.uri);
        } else {
          if (this.corePreferences['workbench.list.openMode'] === 'doubleClick') {
            this.toggleDirectory(item as Directory);
          }
        }
      }
      this.clickTimes = 0;
    }, 200);
  }

  // 命令调用
  async collapseAll() {
    const size = this.treeModel.root.branchSize;
    for (let index = 0; index < size; index++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(index) as Directory;
      if (Directory.is(file) && file.expanded) {
        await file.setCollapsed();
      }
    }
  }

  public expandAllCacheDirectory = async () => {
    await this.fileTreeService.flushEventQueue();
    const size = this.treeModel.root.branchSize;
    for (let index = 0; index < size; index++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(index) as Directory;
      if (Directory.is(file) && !file.expanded && file.branchSize > 0) {
        await file.setExpanded();
      }
    }
  }

  async deleteFileByUris(uris: URI[]) {
    if (this.corePreferences['explorer.confirmDelete']) {
      const ok = localize('file.confirm.delete.ok');
      const cancel = localize('file.confirm.delete.cancel');
      const deleteFilesMessage = `[${uris.map((uri) => uri.displayName).join(',')}]`;
      const confirm = await this.dialogService.warning(formatLocalize('file.confirm.delete', deleteFilesMessage), [cancel, ok]);
      if (confirm !== ok) {
        return;
      }
    }
    // 移除文件
    uris.forEach(async (uri: URI) => {
      if (await this.deleteFile(uri)) {
        this.fileTreeService.deleteAffectedNodes([uri]);
      }
    });
  }

  async deleteFile(uri: URI) {
    const error = await this.fileTreeAPI.delete(uri);
    if (error) {
      this.messageService.error(error);
      return false;
    }
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

  private validateFileName = (promptHandle: RenamePromptHandle | NewPromptHandle, name: string): FileTreeValidateMessage | null => {
    // 转换为合适的名称
    name = this.getWellFormedFileName(name);

    // 不存在文件名称
    if (!name || name.length === 0 || /^\s+$/.test(name)) {
      return {
        message: localize('validate.tree.emptyFileeError'),
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

    let parent: Directory;

    if ((promptHandle as RenamePromptHandle).target) {
      const target = (promptHandle as RenamePromptHandle).target as (File | Directory);
      if (name === target.name) {
        return null;
      }
      parent = target.parent as Directory;
    } else {
      parent = (promptHandle as NewPromptHandle).parent as Directory;
    }

    const names = coalesce(name.split(/[\\/]/));
    if (parent) {
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

    // 判断子路径是否合法
    if (names.some((folderName) => !isValidBasename(folderName))) {
      return {
        message: formatLocalize('validate.tree.invalidFileNameError', this.trimLongName(name)),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    return null;
  }

  private proxyPrompt = (promptHandle: RenamePromptHandle | NewPromptHandle) => {
    let isCommit = false;
    const commit = async (newName) => {
      this.validateMessage = undefined;
      if (promptHandle instanceof RenamePromptHandle) {
        const target = promptHandle.target as (File | Directory);
        const from = target.uri;
        const to = target.uri.parent.resolve(newName);
        promptHandle.addAddonAfter('loading_indicator');
        const error = await this.fileTreeAPI.mv(from, to, target.type === TreeNodeType.CompositeTreeNode);
        promptHandle.removeAddonAfter();
        if (!!error) {
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        this.fileTreeService.moveNode(target.parent as Directory, from.toString(), to.toString());
      } else if (promptHandle instanceof NewPromptHandle) {
        const parent = promptHandle.parent as Directory;
        const newUri = parent.uri.resolve(newName);
        let error;
        promptHandle.addAddonAfter('loading_indicator');
        if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
          error = await this.fileTreeAPI.createDirectory(newUri);
        } else {
          error = await this.fileTreeAPI.createFile(newUri);
        }
        promptHandle.removeAddonAfter();
        if (!!error) {
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        const addNode = await this.fileTreeService.addNode(parent, newName, promptHandle.type);
        if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
          // 文件夹首次创建需要将焦点设到新建的文件夹上
          Event.once(this.treeModel.onChange)(async () => {
            await this.fileTreeHandle.ensureVisible(addNode);
            this.activeFileDecoration(addNode);
          });
        }
      }
      this.fileTreeContextKey.filesExplorerInputFocused.set(false);
      return true;
    };
    const blurCommit = async (newName) => {
      if (isCommit) {
        return false;
      }
      if (!!this.validateMessage) {
        this.validateMessage = undefined;
        return true;
      }
      await commit(newName);
      return true;
    };
    const enterCommit = async (newName) => {
      isCommit = true;
      if (this.validateMessage && this.validateMessage.message) {
        this.validateMessage = undefined;
        promptHandle.removeValidateMessage();
      }
      if (newName.trim() === '' || !!this.validateMessage) {
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
      this.fileTreeContextKey.filesExplorerInputFocused.set(true);
    };
    if (!promptHandle.destroyed) {
      promptHandle.onChange((currentValue) => {
        const validateMessage = this.validateFileName(promptHandle, currentValue);
        if (!!validateMessage) {
          this.validateMessage = validateMessage;
          promptHandle.addValidateMessage(validateMessage);
        } else if (!validateMessage && this.validateMessage && this.validateMessage.value !== currentValue) {
          this.validateMessage = undefined;
          promptHandle.removeValidateMessage();
        }
      });

      promptHandle.onCommit(enterCommit);
      promptHandle.onBlur(blurCommit);
      promptHandle.onFocus(handleFocus);
    }
  }

  async newFilePrompt(uri: URI) {
    await this.fileTreeService.flushEventQueue();
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewTreeNode(path));
    }
  }

  async newDirectoryPrompt(uri: URI) {
    await this.fileTreeService.flushEventQueue();
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewCompositeTreeNode(path));
    }
  }

  async renamePrompt(uri: URI) {
    await this.fileTreeService.flushEventQueue();
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      this.proxyPrompt(await this.fileTreeHandle.promptRename(path));
    }
  }

  public copyFile = async (from: URI[]) => {
    if (this.pasteStore && this.pasteStore.type === PasteTypes.CUT) {
      this._pasteStore.files.forEach((file) => {
        if (file) {
          this.cutDecoration.removeTarget(file as File);
        }
      });
      this.fileTreeContextKey.explorerResourceCut.set(false);
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
    this._pasteStore = {
      files: from.map((uri) => this.fileTreeService.getNodeByUriString(uri.toString())).filter((node) => !!node) as (File | Directory)[],
      type: PasteTypes.COPY,
    };
  }

  public pasteFile = async (to: URI) => {
    let parent = this.fileTreeService.getNodeByUriString(to.toString());
    if (!parent || !this.pasteStore) {
      return;
    }
    if (!Directory.is(parent)) {
      parent = parent.parent as Directory;
    }
    if (this.pasteStore.type === PasteTypes.CUT) {
      for (const file of this.pasteStore.files) {
        if (file) {
          this.cutDecoration.removeTarget(file);
        }
        const to = (parent as Directory).uri.resolve(file.uri.displayName);
        if (!(parent as Directory).expanded) {
          await (parent as Directory).setExpanded(true);
        }
        this.fileTreeService.moveNode((parent as Directory), file.uri.toString(), to.toString());
        const error = await this.fileTreeAPI.mv(file.uri, to);
        if (error) {
          this.messageService.error(error);
          this.fileTreeService.refresh();
        }
      }
      this.fileTreeContextKey.explorerResourceCut.set(false);
      // 更新视图
      this.treeModel.dispatchChange();
    } else if (this.pasteStore.type === PasteTypes.COPY) {
      for (const file of this.pasteStore.files) {
        const to = (parent as Directory).uri.resolve(file.uri.displayName);
        if (!(parent as Directory).expanded) {
          await (parent as Directory).setExpanded(true);
        }
        const res = await this.fileTreeAPI.copyFile(file.uri, to);
        if (res) {
          if ((res as FileStat).uri) {
            const copyUri = new URI((res as FileStat).uri);
            this.fileTreeService.addNode((parent as Directory), copyUri.displayName, Directory.is(file) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode);
          } else {
            this.messageService.error(res);
          }
        }
      }
    }
    this._pasteStore = {
      files: [],
      type: PasteTypes.NONE,
    };
  }

  public cutFile = async (from: URI[]) => {
    if (from.length > 0) {
      this.fileTreeContextKey.explorerResourceCut.set(true);
    }
    const files = from.map((uri) => this.fileTreeService.getNodeByUriString(uri.toString())).filter((node) => !!node) as (File | Directory)[];
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
  }

  public location = async (uri: URI) => {
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      if (!this.fileTreeHandle) {
        return;
      }
      const node = await this.fileTreeHandle.ensureVisible(path);
      if (node) {
        this.activeFileDecoration(node as File);
      }
    }
  }

  public locationOnShow = (uri: URI) => {
    this._nextLocationTarget = uri;
  }

  public performLocationOnHandleShow = async () => {
    if (this._nextLocationTarget) {
      await this.location(this._nextLocationTarget);
      this._nextLocationTarget = undefined;
    }
  }
}
