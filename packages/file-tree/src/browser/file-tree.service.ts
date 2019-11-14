import { observable, runInAction, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  WithEventBus,
  CommandService,
  IContextKeyService,
  URI,
  Uri,
  Emitter,
  EDITOR_COMMANDS,
  AppConfig,
  formatLocalize,
  localize,
  IContextKey,
  memoize,
} from '@ali/ide-core-browser';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { IFileTreeAPI, PasteTypes, IParseStore, FileStatNode } from '../common';
import { IFileServiceClient, FileChange, FileChangeType, IFileServiceWatcher } from '@ali/ide-file-service/lib/common';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItemRendered } from './file-tree.view';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';
import { IDialogService } from '@ali/ide-overlay';
import { Directory, File } from './file-tree-item';
import { ExplorerResourceCut } from '@ali/ide-core-browser/lib/contextkey/explorer';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { MenuService } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { MenuId } from '@ali/ide-core-browser/lib/menu/next';

export type IFileTreeItemStatus = Map<string, {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
  cuted?: boolean;
  needUpdated?: boolean;
  file: Directory | File;
}>;

export interface IFileTreeServiceProps {
  onSelect: (files: (Directory | File)[]) => void;
  onTwistieClick?: (file: IFileTreeItemRendered) => void;
  onDragStart: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDragOver: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDragEnter: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDragLeave: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDrop: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onContextMenu: (nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) => void;
  onChange: (node: IFileTreeItemRendered, value: string) => void;
  onBlur: () => void;
  onFocus: () => void;
  draggable: boolean;
  editable: boolean;
}

export interface IWorkspaceRoot {
  uri: string;
  isDirectory: boolean;
  lastModification?: number;
}

export type IWorkspaceRoots = IWorkspaceRoot[];

@Injectable()
export class FileTreeService extends WithEventBus {

  static WAITING_PERIOD = 100;
  @observable.shallow
  files: (Directory | File)[] = [];

  @observable.shallow
  status: IFileTreeItemStatus = new Map();

  private _root: FileStat | undefined;
  private _isFocused: boolean = false;

  private fileServiceWatchers: {
    [uri: string]: IFileServiceWatcher,
  } = {};

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(IFileTreeAPI)
  private fileAPI: IFileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(IDialogService)
  dislogService: IDialogService;

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

  @Autowired(MenuService)
  private readonly menuService: MenuService;

  private statusChangeEmitter = new Emitter<Uri[]>();
  private explorerResourceCut: IContextKey<boolean>;

  private pasteStore: IParseStore = {
    files: [],
    type: PasteTypes.NONE,
  };

  get onStatusChange() {
    return this.statusChangeEmitter.event;
  }

  constructor(
  ) {
    super();
    this.init();
  }

  async init() {
    const roots: IWorkspaceRoots = await this.workspaceService.roots;

    this.explorerResourceCut = ExplorerResourceCut.bind(this.contextKeyService);

    this._root = this.workspaceService.workspace;
    await this.getFiles(roots);

    this.workspaceService.onWorkspaceChanged(async (workspace: FileStat[]) => {
      this._root = this.workspaceService.workspace;
      this.dispose();
      await this.getFiles(workspace);
    });
  }

  dispose() {
    for (const watcher of Object.keys(this.fileServiceWatchers)) {
      this.fileServiceWatchers[watcher].dispose();
    }
  }

  @memoize get contributedContextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.ExplorerContext, this.contextKeyService);
    this.addDispose(contributedContextMenu);
    return contributedContextMenu;
  }

  get hasPasteFile(): boolean {
    return this.pasteStore.files.length > 0 && this.pasteStore.type !== PasteTypes.NONE;
  }

  get isFocused(): boolean {
    return this._isFocused;
  }

  set isFocused(value: boolean) {
    if (!value) {
      // 清空focused状态
      this.resetFilesFocusedStatus();
    }
    this._isFocused = value;
  }

  get isSelected(): boolean {
    for (const [, status] of this.status) {
      if (status.selected) {
        return true;
      }
    }
    return false;
  }

  get isMutiWorkspace(): boolean {
    return !!this.workspaceService.workspace && !this.workspaceService.workspace.isDirectory;
  }

  get root(): URI {
    if (this._root) {
      return new URI(this._root.uri);
    }
    return URI.file(this.config.workspaceDir);
  }

  get focusedUris(): URI[] {
    const focused: URI[] = [];
    for (const [, status] of this.status) {
      if (status.focused) {
        focused.push(status.file.uri);
      }
    }
    return focused;
  }

  get selectedUris(): URI[] {
    const selected: URI[] = [];
    for (const [, status] of this.status) {
      if (status.selected) {
        selected.push(status.file.uri);
      }
    }
    return selected;
  }

  get selectedFiles(): (Directory | File)[] {
    const selected: (Directory | File)[] = [];
    for (const [, status] of this.status) {
      if (status.selected) {
        selected.push(status.file);
      }
    }
    return selected;
  }

  get focusedFiles(): (Directory | File)[] {
    const selected: (Directory | File)[] = [];
    for (const [key, status] of this.status) {
      if (status.focused) {
        selected.push(status.file);
      }
    }
    return selected;
  }

  getStatutsKey(file: Directory | File | string | URI) {
    if (file instanceof URI) {
      file = file.toString();
    }
    if (typeof file === 'string') {
      if (!this.status.has(file)) {
        return file + '#';
      }
      return file;
    }
    // 为软链接文件添加标记
    if (file.filestat.isSymbolicLink || file.filestat.isInSymbolicDirectory) {
      return file.filestat.uri + '#';
    }
    return file.filestat.uri;
  }

  getParent(uri: URI) {
    const statusKey = this.getStatutsKey(uri);
    const status = this.status.get(statusKey);
    if (status) {
      return status.file.parent;
    }
  }

  getChildren(uri: URI) {
    const statusKey = this.getStatutsKey(uri);
    const status = this.status.get(statusKey);
    if (status) {
      if (Directory.isDirectory(status.file)) {
        const item = status.file as Directory;
        return item.children;
      }
      return undefined;
    }
  }

  @action
  async createFile(node: Directory | File, newName: string, isDirectory: boolean = false) {
    const uri = node.uri;
    this.removeStatusAndFileFromParent(uri);
    if (newName === TEMP_FILE_NAME) {
      return;
    }
    const exist = await this.fileAPI.exists(uri);
    if (!exist) {
      const parentStatusKey = this.getStatutsKey(uri.parent);
      const parent = this.status.get(parentStatusKey!)!.file as Directory;
      if (!parent) {
        return;
      }
      const newFile = this.fileAPI.generatorFileFromFilestat({
        uri: uri.parent.resolve(newName).toString(),
        lastModification: new Date().getTime(),
        isDirectory,
      }, parent);
      parent.addChildren(newFile);
      this.updateFileStatus([parent]);
      // 先修改数据，后置文件操作，在文件创建成功后会有事件通知前台更新
      // 保证在调用定位文件命令时文件树中存在新建的文件
      if (isDirectory) {
        this.fileAPI.createFolder(uri.parent.resolve(newName));
      } else {
        this.fileAPI.createFile(uri.parent.resolve(newName));
      }
    }
  }

  @action
  async createFolder(node: Directory | File, newName: string) {
    await this.createFile(node, newName, true);
  }

  /**
   * 从status及files里移除资源
   * @param uri
   */
  @action
  removeStatusAndFileFromParent(uri: URI) {
    const parentStatusKey = this.getStatutsKey(uri.parent);
    const parentStatus = this.status.get(parentStatusKey);
    const parent = parentStatus && parentStatus!.file as Directory;
    if (parent) {
      // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
      if (parentStatus && !parentStatus!.expanded) {
        this.status.set(parentStatusKey, {
          ...parentStatus!,
          file: parentStatus.file,
          needUpdated: true,
        });
      } else {
        const remove = parent.removeChildren(uri);
        if (remove) {
          remove.forEach((item) => {
            const statusKey = this.getStatutsKey(item.uri);
            this.status.delete(statusKey);
          });
        }
      }
    }
  }

  @action
  removeTempStatus(node?: Directory | File) {
    if (node) {
      const statusKey = this.getStatutsKey(node.uri);
      const status = this.status.get(statusKey);
      if (!status) {
        return;
      }
      if (status.file.name === TEMP_FILE_NAME) {
        this.removeStatusAndFileFromParent(status.file.uri);
      } else {
        status.file.updateTemporary(false);
        this.status.set(statusKey, {
          ...status!,
          file: status.file,
        });
      }
    } else {
      for (const [, status] of this.status) {
        if (status && status.file && status.file.name === TEMP_FILE_NAME) {
          this.removeStatusAndFileFromParent(status.file.uri);
          break;
        }
      }
    }
  }

  /**
   * 创建临时文件
   * @param uri
   */
  @action
  async createTempFile(uri: URI, isDirectory?: boolean): Promise<URI | void> {
    const parentFolder = this.searchFileParent(uri, (path: URI) => {
      const statusKey = this.getStatutsKey(path);
      const status = this.status.get(statusKey);
      if (status && status.file && status.file!.filestat.isDirectory && !status.file!.isTemporary) {
        return true;
      } else {
        return false;
      }
    });
    if (!parentFolder) {
      return;
    }
    const parentFolderStatusKey = this.getStatutsKey(parentFolder);
    const parentStatus = this.status.get(parentFolderStatusKey);
    if (!parentStatus) {
      return;
    }
    if (!parentStatus.expanded) {
      await this.updateFilesExpandedStatus(parentStatus.file);
    }
    const tempFileUri = parentFolder.resolve(TEMP_FILE_NAME);
    const parent = parentStatus.file as Directory;
    const tempfile: Directory | File = isDirectory ? this.fileAPI.generatorTempFolder(tempFileUri, parent) : this.fileAPI.generatorTempFile(tempFileUri, parent);
    const tempFileStatusKey = tempFileUri.toString();
    parent.addChildren(tempfile);
    this.status.set(tempFileStatusKey, {
      selected: false,
      focused: false,
      file: tempfile,
    });
    return tempfile.uri;
  }

  /**
   * 创建临时文件夹
   * @param uri
   */
  @action
  async createTempFolder(uri: URI): Promise<URI | void> {
    return this.createTempFile(uri, true);
  }

  /**
   * 创建临时文件用于重命名
   * @param uri
   */
  @action
  async renameTempFile(uri: URI) {
    const statusKey = this.getStatutsKey(uri);
    const status = this.status.get(statusKey);
    if (!status) {
      return;
    }
    const file = status.file.updateTemporary(true);
    this.status.set(statusKey, {
      ...status,
      file,
    });
  }

  async renameFile(node: Directory | File, value: string) {
    const exist = await this.fileAPI.exists(node.uri.parent.resolve(value));
    const uri = node.uri;
    if (!exist && (value && value !== node.name)) {
      const parentStatusKey = this.getStatutsKey(uri.parent);
      const parent = this.status.get(parentStatusKey!)!.file as Directory;
      if (!parent) {
        return;
      }
      const newFile = this.fileAPI.generatorFileFromFilestat({
        uri: uri.parent.resolve(value).toString(),
        lastModification: new Date().getTime(),
        isDirectory: node.filestat.isDirectory,
      }, parent);
      parent.removeChildren(uri);
      parent.addChildren(newFile);
      this.updateFileStatus([parent]);
      // 先修改数据，后置文件操作，在文件重命名成功后会有事件通知前台更新
      // 保证在调用定位文件命令时文件树中存在修改后的文件
      this.fileAPI.moveFile(node.uri, node.uri.parent.resolve(value), node.filestat.isDirectory);
    }

    const statusKey = this.getStatutsKey(node);
    const status = this.status.get(statusKey);
    if (!status) {
      return;
    }
    const file = status.file.updateTemporary(false);
    this.status.set(statusKey, {
      ...status,
      file,
    });
  }

  async deleteFile(uri: URI) {
    try {
      this.removeStatusAndFileFromParent(uri);
      await this.fileAPI.deleteFile(uri);
    } catch (e) {
      // solve error
    }
  }

  async moveFile(from: URI, targetDir: URI) {
    const to = targetDir.resolve(from.displayName);
    const toStatusKey = this.getStatutsKey(to);
    const fromStatusKey = this.getStatutsKey(from);
    const status = this.status.get(toStatusKey);
    const fromStatus = this.status.get(fromStatusKey);
    this.resetFilesSelectedStatus();
    if (from.isEqual(to) && status) {
      this.status.set(toStatusKey, {
        ...status,
        focused: true,
        file: status.file,
      });
      // 路径相同，不处理
      return;
    }
    if (status) {
      // 如果已存在该文件，提示是否替换文件
      const ok = localize('file.confirm.replace.ok');
      const cancel = localize('file.confirm.replace.cancel');
      const comfirm = await this.dislogService.warning(formatLocalize('file.confirm.replace', from.displayName, targetDir.displayName), [cancel, ok]);
      if (comfirm !== ok) {
        return;
      } else {
        await this.fileAPI.moveFile(from, to, fromStatus && fromStatus.file.filestat.isDirectory);
        this.status.set(toStatusKey, {
          ...status,
          file: status.file,
          focused: true,
        });
      }
    } else {
      await this.fileAPI.moveFile(from, to, fromStatus && fromStatus.file.filestat.isDirectory);
    }
  }

  async moveFiles(froms: URI[], targetDir: URI) {
    for (const from of froms) {
      if (from.isEqualOrParent(targetDir)) {
        return;
      }
    }
    if (this.corePreferences['explorer.confirmMove']) {
      const ok = localize('file.confirm.move.ok');
      const cancel = localize('file.confirm.move.cancel');
      const comfirm = await this.dislogService.warning(formatLocalize('file.confirm.move', `[${froms.map((uri) => uri.displayName).join(',')}]`, targetDir.displayName), [cancel, ok]);
      if (comfirm !== ok) {
        return;
      }
    }
    for (const from of froms) {
      await this.moveFile(from, targetDir);
    }
  }

  async deleteFiles(uris: URI[]) {
    if (this.corePreferences['explorer.confirmDelete']) {
      const ok = localize('file.confirm.delete.ok');
      const cancel = localize('file.confirm.delete.cancel');
      const deleteFilesMessage = `[${uris.map((uri) => uri.displayName).join(',')}]`;
      const comfirm = await this.dislogService.warning(formatLocalize('file.confirm.delete', deleteFilesMessage), [cancel, ok]);
      if (comfirm !== ok) {
        return;
      }
    }
    uris.forEach(async (uri: URI) => {
      await this.deleteFile(uri);
    });
  }

  /**
   * 折叠所有节点
   */
  @action
  collapseAll(uri?: URI) {
    if (!uri) {
      for (const [key, status] of this.status) {
        this.status.set(key, {
          ...status,
          file: status.file,
          expanded: false,
        });
      }
    } else {
      const statusKey = this.getStatutsKey(uri.toString());
      const status = this.status.get(statusKey);
      let children: (Directory | File)[] = [];
      if (status && status.file) {
        if (Directory.isDirectory(status.file)) {
          const item = status.file as Directory;
          children = item.children;
        }
      }
      if (children && children.length > 0) {
        children.forEach((child) => {
          if (child.filestat.isDirectory) {
            const childPath = this.getStatutsKey(child.uri.toString());
            this.status.set(childPath, {
              ...this.status.get(childPath)!,
              file: child,
              expanded: false,
              needUpdated: true,
            });
          }
        });
      }
    }
  }

  /**
   * 刷新所有节点
   */
  @action
  async refresh(uri: URI = this.root, lowcost?: boolean) {
    const statusKey = this.getStatutsKey(uri);
    const status = this.status.get(statusKey);
    if (!status) {
      return;
    }
    if (Directory.isDirectory(status.file)) {
      this.status.set(statusKey, {
        ...status,
        file: status.file,
        needUpdated: true,
      });
      if (status.expanded) {
        this.refreshAffectedNode(status.file, lowcost);
      }
    }
  }

  searchFileParent(uri: URI, check: any) {
    let parent = uri;
    // 超过两级找不到文件，默认为ignore规则下的文件夹变化
    while (parent) {
      if (parent.isEqual(this.root)) {
        return this.root;
      }
      if (check(parent)) {
        return parent;
      }
      parent = parent.parent;
    }
    return false;
  }

  replaceFileName(uri: URI, name: string): URI {
    return uri.parent.resolve(name);
  }

  /**
   * 当选中事件激活时同时也为焦点事件
   * 需要同时设置seleted与focused
   * @param file
   * @param value
   */
  @action
  updateFilesSelectedStatus(files: (Directory | File)[], value: boolean) {
    if (files.length === 0) {
      this.resetFilesFocusedStatus();
    } else {
      this.resetFilesSelectedStatus();
      files.forEach((file: Directory | File) => {
        const statusKey = this.getStatutsKey(file);
        const status = this.status.get(statusKey);
        if (status) {
          this.status.set(statusKey, {
            ...status,
            selected: value,
            focused: value,
          });
        }
      });
    }
  }

  /**
   * 重置所有文件Selected属性
   */
  @action
  resetFilesSelectedStatus() {
    for (const [key, status] of this.status) {
      this.status.set(key, {
        ...status,
        selected: false,
        focused: false,
      });
    }
  }

  /**
   * 重置所有文件cuted属性
   */
  @action
  resetFilesCutedStatus() {
    for (const [key, status] of this.status) {
      this.status.set(key, {
        ...status,
        cuted: false,
      });
    }
  }

  /**
   * 焦点事件与选中事件不冲突，可同时存在
   * 选中为A，焦点为B的情况
   * @param file
   * @param value
   */
  @action
  updateFilesFocusedStatus(files: (Directory | File)[], value: boolean) {
    this.resetFilesFocusedStatus();
    files.forEach((file: Directory | File) => {
      const statusKey = this.getStatutsKey(file);
      const status = this.status.get(statusKey);
      if (status) {
        this.status.set(statusKey, {
          ...status!,
          focused: value,
        });
      }
    });
  }

  /**
   * 重置所有文件Focused属性
   */
  @action
  resetFilesFocusedStatus() {
    for (const [key, status] of this.status) {
      this.status.set(key, {
        ...status,
        focused: false,
      });
    }
  }

  async refreshAffectedNodes(uris: URI[]) {
    const nodes = this.getAffectedNodes(uris);
    for (const node of nodes.values()) {
      await this.refreshAffectedNode(node, true);
    }
    return nodes.size !== 0;
  }

  private getAffectedNodes(uris: URI[]): Map<string, Directory> {
    const nodes = new Map<string, Directory>();
    for (const uri of uris) {
      const statusKey = this.getStatutsKey(uri.parent);
      const status = this.status.get(statusKey);
      if (status && status.file && Directory.isDirectory(status.file)) {
        nodes.set(status.file.id, status.file as Directory);
      }
    }
    return nodes;
  }

  @action
  async refreshAffectedNode(file: Directory | File, lowcost?: boolean) {
    const statusKey = this.getStatutsKey(file);
    const status = this.status.get(statusKey);
    let item: any = file;
    if (status) {
      item = status.file as Directory;
    }
    if (Directory.isDirectory(item)) {
      await item.getChildren();
      const children = item.children;
      if (lowcost) {
        for (const child of children) {
          const childStatusKey = this.getStatutsKey(child);
          const childStatus = this.status.get(childStatusKey);
          if (childStatus && childStatus.expanded && Directory.isDirectory(child)) {
            (child as Directory).updateChildren((childStatus.file as Directory).children);
          }
        }
      } else {
        for (const child of children) {
          const childStatusKey = this.getStatutsKey(child);
          const childStatus = this.status.get(childStatusKey);
          if (childStatus && childStatus.expanded) {
            await this.refreshAffectedNode(child);
          }
        }
      }
      if (!file.parent && status) {
        // 更新根节点引用
        // file.parent不存在即为根节点
        this.files = [].concat(item);
        this.updateFileStatus(this.files);
      } else if (file.parent) {
        file.parent.replaceChildren(item);
        this.updateFileStatus([item]);
      }
    }
  }

  @action
  async updateFilesExpandedStatus(file: Directory | File) {
    const statusKey = this.getStatutsKey(file);
    const status = this.status.get(statusKey);
    let item: any = file;
    if (status) {
      item = status.file as Directory;
    } else {
      return;
    }
    if (Directory.isDirectory(file)) {
      if (status && !status.expanded) {
        // 如果当前目录下的子文件为空，同时具备父节点，尝试调用fileservice加载文件
        // 如果当前目录具备父节点(即非根目录)，尝试调用fileservice加载文件
        if (item.children.length === 0 && item.parent || status && status.needUpdated && item.parent) {
          await item.getChildren();
          this.updateFileStatus([item]);
        }
        this.status.set(statusKey, {
          ...status!,
          expanded: true,
          needUpdated: false,
        });
      } else {
        this.status.set(statusKey, {
          ...status!,
          expanded: false,
        });
      }
    }
  }

  @action
  async updateFilesExpandedStatusByQueue(paths: URI[]) {
    if (paths.length === 0) {
      return;
    }
    let uri = paths.pop();
    let statusKey = uri && this.getStatutsKey(uri);
    while (statusKey) {
      const status = this.status.get(statusKey);
      if (status && !status.expanded) {
        await this.updateFilesExpandedStatus(status.file);
      }
      uri = paths.pop();
      statusKey = uri && this.getStatutsKey(uri);
    }
  }

  @action
  updateFileStatus(files: (Directory | File)[]) {
    const changeUri: Uri[] = [];
    files.forEach((file) => {
      const statusKey = this.getStatutsKey(file);
      const status = this.status.get(statusKey);
      if (status) {
        const item = file instanceof Directory ? file : status.file as Directory;
        if (Directory.isDirectory(file)) {
          this.status.set(statusKey, {
            ...status,
            file: item,
          });
          this.updateFileStatus(item.children);
        } else {
          this.status.set(statusKey, {
            ...status,
            file,
          });
        }
      } else {
        const item = file as Directory;
        if (Directory.isDirectory(item)) {
          this.status.set(statusKey, {
            selected: item.selected,
            focused: item.focused,
            expanded: item.expanded,
            file: item,
          });
          this.updateFileStatus(item.children);
        } else {
          this.status.set(statusKey, {
            selected: item.selected,
            focused: item.focused,
            file: item,
          });
        }
      }
      changeUri.push(Uri.parse(file.uri.toString()));
    });
    this.statusChangeEmitter.fire(changeUri);
  }

  private getDeletedUris(changes: FileChange[]): URI[] {
    return changes.filter((change) => change.type === FileChangeType.DELETED).map((change) => new URI(change.uri));
  }

  private getAffectedUris(changes: FileChange[]): URI[] {
    return changes.filter((change) => !this.isFileContentChanged(change)).map((change) => new URI(change.uri));
  }

  private isRootAffected(changes: FileChange[]): boolean {
    const root = this.root;
    if (FileStatNode.is(root)) {
      return changes.some((change) =>
        change.type < FileChangeType.DELETED && change.uri.toString() === root.uri.toString(),
      );
    }
    return false;
  }

  private isFileContentChanged(change: FileChange): boolean {
    return change.type === FileChangeType.UPDATED && FileStatNode.isContentFile(this.status.get(change.uri));
  }

  private deleteAffectedNodes(uris: URI[]) {
    let parent: Directory;
    let parentFolder: URI | boolean;
    let parentStatus: any;
    let parentStatusKey: string;
    for (const uri of uris) {
      const statusKey = this.getStatutsKey(uri);
      const status = this.status.get(statusKey);
      if (!status) {
        return;
      }
      parent = status && status.file!.parent as Directory;
      if (!parent) {
        return;
      }
      parentFolder = parent.uri;
      parentStatusKey = this.getStatutsKey(parentFolder);
      parentStatus = this.status.get(parentStatusKey);
      // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
      if (parentStatus && !parentStatus!.expanded) {
        this.status.set(parentStatusKey, {
          ...parentStatus!,
          file: parentStatus.file,
          needUpdated: true,
        });
        return;
      }
      const remove = parent.removeChildren(uri);
      if (remove) {
        remove.forEach((item) => {
          const statusKey = this.getStatutsKey(item.uri);
          this.status.delete(statusKey);
        });
      }
    }
  }

  private onFilesChanged(changes: FileChange[]): void {
    if (!this.refreshAffectedNodes(this.getAffectedUris(changes)) && this.isRootAffected(changes)) {
      this.refresh();
    }
    this.deleteAffectedNodes(this.getDeletedUris(changes));
  }

  @action
  private async getFiles(roots: IWorkspaceRoots): Promise<(Directory | File)[]> {
    let result = [];
    for (const root of roots) {
      let files;
      if (root.isDirectory) {
        files = await this.fileAPI.getFiles(root.uri);
        this.updateFileStatus(files);
        result = result.concat(files);
      }
      const watcher = await this.fileServiceClient.watchFileChanges(new URI(root.uri));
      this.fileServiceWatchers[root.uri] = watcher;
      watcher.onFilesChanged((changes: FileChange[]) => {
        this.onFilesChanged(changes);
      });
    }
    this.files = result;
    return result;
  }

  /**
   * 打开文件
   * @param uri
   */
  openFile(uri: URI) {
    // 当打开模式为双击同时预览模式生效时，默认单击为预览文件
    const preview = this.corePreferences['editor.previewMode'];
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview });
  }

  /**
   * 打开并固定文件
   * @param uri
   */
  openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: false, preview: false });
  }

  /**
   * 在侧边栏打开文件
   * @param {URI} uri
   * @memberof FileTreeService
   */
  openToTheSide(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: false, split: 4 /** right */ });
  }

  /**
   * 比较选中的两个文件
   * @param original
   * @param modified
   */
  compare(original: URI, modified: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
      original,
      modified,
    });
  }

  copyFile(from: URI[]) {
    this.resetFilesCutedStatus();
    this.pasteStore = {
      files: from,
      type: PasteTypes.COPY,
    };
  }

  @action
  cutFile(from: URI[]) {
    if (from.length > 0) {
      this.explorerResourceCut.set(true);
    }
    this.pasteStore = {
      files: from,
      type: PasteTypes.CUT,
    };
    this.resetFilesCutedStatus();
    for (const uri of from) {
      const statusKey = this.getStatutsKey(uri);
      const status = this.status.get(statusKey);
      this.status.set(statusKey, {
        ...status!,
        cuted: true,
      });
    }
  }

  pasteFile(to: URI) {
    if (this.pasteStore.type === PasteTypes.CUT) {
      this.pasteStore.files.forEach((file) => {
        this.fileAPI.moveFile(file, to.resolve(file.displayName));
      });
      this.resetFilesCutedStatus();
      this.pasteStore = {
        files: [],
        type: PasteTypes.NONE,
      };
      this.explorerResourceCut.set(false);
    } else if (this.pasteStore.type === PasteTypes.COPY) {
      this.pasteStore.files.forEach((file) => {
        this.fileAPI.copyFile(file, to.resolve(file.displayName));
      });
    }
  }
}
