import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel, DecorationsManager, Decoration, IRecycleTreeHandle, NodeType } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel } from '../file-tree-model';
import * as styles from '../file-tree-node.module.less';
import { File, Directory } from '../file-tree-nodes';
import { CorePreferences, IContextKey, URI } from '@ali/ide-core-browser';
import { FileContextKey } from '../file-contextkey';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';

export interface IFileTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class FileTreeModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(FileTreeService)
  private readonly fileTreeService: FileTreeService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(FileContextKey)
  private readonly fileContextKey: FileContextKey;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  private _treeModel: TreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  // 即使选中态也是焦点态的节点，全局仅会有一个
  private _focusedFile: File | Directory | undefined;
  // 选中态的节点，会可能有多个
  private _selectedFiles: (File | Directory)[] = [];
  // 待粘贴的文件
  private _pasteFiles: (File | Directory)[] = [];

  private clickTimes: number;
  private clickTimer: any;
  private preContextMenuFocusedFile: File | Directory | null;

  // 右键菜单ContextKey，相对独立
  // TODO：后续需支持通过DOM获取context，这样无需耦合contextMenuService
  private _currentRelativeUriContextKey: IContextKey<string>;
  private _currentContextUriContextKey: IContextKey<string>;
  private _contextMenuResourceContext: ResourceContextKey;

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
  get pasteFiles() {
    return this._pasteFiles;
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
    const root = await this.fileTreeService.resolveChildren();
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
    this.initDecorations(root);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
  }

  /**
   * 多选情况下，焦点节点只要一个，选中节点有多个
   * 单选情况下，焦点节点与选中节点均只有一个
   * 在文件树空白区域邮件时，焦点元素为根节点
   * @param files 选中节点
   * @param file 焦点节点
   */
  private setFileTreeContextKey(file: Directory | File, files: (Directory | File)[]) {
    const isSingleFolder = !this.fileTreeService.isMutiWorkspace;
    this.fileContextKey.explorerFolder.set((isSingleFolder && !file) || !!file && Directory.is(file));
    this.currentContextUriContextKey.set(file.uri.toString());
    this.currentRelativeUriContextKey.set(((this.treeModel.root as Directory).uri.relative(file.uri) || '').toString());
    this.contextMenuResourceContext.set(file.uri);
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: File | Directory ) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return ;
    }
    this.preContextMenuFocusedFile = null;
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
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return ;
    }

    if (this.focusedFile !== target) {
      if (this.focusedFile) {
        if (removePreFocusedDecoration) {
          // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
          if (this.preContextMenuFocusedFile) {
            this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
            this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
          } else {
            // 多选情况下第一次切换焦点文件
            this.focusedDecoration.removeTarget(this.focusedFile);
          }
          this.preContextMenuFocusedFile = target;
        } else {
          this.preContextMenuFocusedFile = null;
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedFile = target;
        this._selectedFiles.push(target);
        // 通知视图更新
        this.treeModel.dispatchChange();
      }
    }
  }

  // 选中范围内的所有节点
  activeFileDecorationByRange = (begin: number, end: number) => {
    this.clearFileSelectedDecoration();
    this.preContextMenuFocusedFile = null;
    for (; begin <= end; begin ++) {
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
      if (this.focusedFile) {
        node = this.focusedFile;
      } else {
        node = nodes[0];
      }
    }

    this.setFileTreeContextKey(node, nodes);

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

  handlerItemRangeClick = (item: File | Directory, type: NodeType) => {
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

  handleItemToggleClick = (item: File | Directory, type: NodeType) => {
    // 单选操作默认先更新选中状态
    if (type === NodeType.CompositeTreeNode || type === NodeType.TreeNode) {
      this.activeFileFocusedDecoration(item);
    }
  }

  handleItemClick = (item: File | Directory, type: NodeType) => {
    this.clickTimes ++;
    // 单选操作默认先更新选中状态
    if (type === NodeType.CompositeTreeNode || type === NodeType.TreeNode) {
      this.activeFileDecoration(item);
    }
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (type === NodeType.CompositeTreeNode) {
      if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
        this.toggleDirectory(item as Directory);
      }
    } else if (type === NodeType.TreeNode) {
      this.fileTreeService.openFile(item.uri);
    }
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      // 单击事件
      // 200ms内多次点击默认为双击事件
      if (this.clickTimes > 1) {
        if (type === NodeType.TreeNode) {
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

  async deleteFileByUris(uris: URI[]) {

  }

  async renameFileByUri(uri: URI) {

  }

  async newFilePrompt(uri: URI) {

  }

  async newDirectoryPrompt(uri: URI) {

  }

  async renamePrompt(uri: URI) {

  }

  async mv(from: File | Directory, to?: Directory) {

  }

  async create(target: Directory, name: string) {

  }

  async compare(from: URI, to: URI) {

  }

  async copyFile(uris: URI[]) {

  }

  async pasteFile(uri: URI) {

  }

  async cutFile(uris: URI[]) {

  }

}
