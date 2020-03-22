import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel, DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, RenamePromptHandle, NewPromptHandle, ValidateMessage, VALIDATE_TYPE } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel } from '../file-tree-model';
import { File, Directory } from '../file-tree-nodes';
import { CorePreferences, IContextKey, URI, trim, rtrim, localize, coalesce, formatLocalize, isValidBasename } from '@ali/ide-core-browser';
import { FileContextKey } from '../file-contextkey';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Path } from '@ali/ide-core-common/lib/path';
import { observable, runInAction } from 'mobx';
import { IFileTreeAPI } from '../../common';
import * as styles from '../file-tree-node.module.less';
import { DragAndDropService } from './file-tree-dnd.service';

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

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  private _treeModel: TreeModel;
  private _dndService: DragAndDropService;

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

  @observable.shallow
  validateMessage: ValidateMessage | undefined;

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
    const root = (await this.fileTreeService.resolveChildren())[0];
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
    this.initDecorations(root);
    // _dndService依赖装饰器逻辑加载
    this._dndService = this.injector.get<any>(DragAndDropService, [this]);
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
  private setFileTreeContextKey(file: Directory | File) {
    const isSingleFolder = !this.fileTreeService.isMutiWorkspace;
    this.fileContextKey.explorerFolder.set((isSingleFolder && !file) || !!file && Directory.is(file));
    this.currentContextUriContextKey.set(file.uri.toString());
    this.currentRelativeUriContextKey.set(((this.treeModel.root as Directory).uri.relative(file.uri) || '').toString());
    this.contextMenuResourceContext.set(file.uri);
  }

  private async getFileTreeNodePathByUri(uri: URI) {
    const isSingleFolder = !this.fileTreeService.isMutiWorkspace;
    let rootUri;
    if (isSingleFolder) {
      rootUri = this.workspaceService.workspace?.uri;
    } else {
      rootUri = (await this.workspaceService.roots).find((root) => {
        return new URI(root.uri).isEqualOrParent(uri);
      })?.uri;
    }
    if (rootUri) {
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
        // 通知视图更新
        this.treeModel.dispatchChange();
      }
    }
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
    // 单选操作默认先更新选中状态
    if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
      this.activeFileFocusedDecoration(item);
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

  async deleteFileByUris() {

  }

  async renameFileByUri() {

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

  validateFileName = (promptHandle: RenamePromptHandle | NewPromptHandle, name: string): ValidateMessage | null => {
    // 转换为合适的名称
    name = this.getWellFormedFileName(name);

    // 不存在文件名称
    if (!name || name.length === 0 || /^\s+$/.test(name)) {
      return {
        message: localize('validate.tree.emptyFileeError'),
        type: VALIDATE_TYPE.ERROR,
      };
    }

    // 不允许开头为分隔符的名称
    if (name[0] === '/' || name[0] === '\\') {
      return {
        message: localize('validate.tree.fileNameStartsWithSlashError'),
        type: VALIDATE_TYPE.ERROR,
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
          type: VALIDATE_TYPE.ERROR,
        };
      }
    }

    // 判断子路径是否合法
    if (names.some((folderName) => !isValidBasename(folderName))) {
      return {
        message: formatLocalize('validate.tree.invalidFileNameError', this.trimLongName(name)),
        type: VALIDATE_TYPE.ERROR,
      };
    }

    return null;
  }

  // private dispatchWatchEvent(path: string, event: IWatcherEvent) {
  //   const { root } = this.treeModel;
  //   const watcher = root.watchEvents.get(path);
  //   if (watcher && watcher.callback) {
  //     watcher.callback(event);
  //   }
  // }

  private proxyPrompt = (promptHandle: RenamePromptHandle | NewPromptHandle) => {
    const commit = async (newName) => {
      if (newName.trim() === '' && !!this.validateMessage) {
        return true;
      }
      if (promptHandle instanceof RenamePromptHandle) {
        const target = promptHandle.target as (File | Directory);
        const from = target.uri;
        const to = target.uri.parent.resolve(newName);
        await this.fileTreeAPI.mv(from, to, target.type === TreeNodeType.CompositeTreeNode);
        // const oldPath = target.path;
        // const newPath = new Path(target.path).dir.join(newName).toString();
        // this.dispatchWatchEvent(target.path, {
        //   type: WatchEvent.Moved,
        //   oldPath,
        //   newPath,
        // });
      } else if (promptHandle instanceof NewPromptHandle) {
        const parent = promptHandle.parent as Directory;
        const newUri = parent.uri.resolve(newName);
        await this.fileTreeAPI.create(newUri);

        // this.dispatchWatchEvent(parent.path, {
        //   type: WatchEvent.Added,
        //   directory: ,
        //   node: ,
        // });
      }
      // 返回true时，输入框会隐藏
      return true;
    };
    if (!promptHandle.destroyed) {
      promptHandle.onChange((currentValue) => {
        const validateMessage = this.validateFileName(promptHandle, currentValue);
        if (!!validateMessage) {
          runInAction(() => {
            this.validateMessage = validateMessage!;
          });
        } else {
          runInAction(() => {
            this.validateMessage = undefined;
          });
        }
      });

      promptHandle.onCommit(commit);
      promptHandle.onBlur(commit);
    }
  }

  async newFilePrompt(uri: URI) {
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewTreeNode(path, TreeNodeType.TreeNode));
    }
  }

  async newDirectoryPrompt(uri: URI) {
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewTreeNode(path, TreeNodeType.CompositeTreeNode));
    }
  }

  async renamePrompt(uri: URI) {
    const path = await this.getFileTreeNodePathByUri(uri);
    if (path) {
      this.proxyPrompt(await this.fileTreeHandle.promptRename(path));
    }
  }

  async mv() {

  }

  async create() {

  }

  async compare() {

  }

  async copyFile() {

  }

  async pasteFile() {

  }

  async cutFile() {

  }

}
