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
} from '@ali/ide-core-browser';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { FileTreeAPI, IFileTreeItem, IFileTreeItemStatus } from '../common';
import { IFileServiceClient, FileChange, FileChangeType, IFileServiceWatcher } from '@ali/ide-file-service/lib/common';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItemRendered } from './file-tree.view';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';
import { IDialogService } from '@ali/ide-overlay';

export interface IFileTreeServiceProps {
  onSelect: (files: IFileTreeItem[]) => void;
  onDragStart: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDragOver: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDragEnter: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDragLeave: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onDrop: (node: IFileTreeItemRendered, event: React.DragEvent) => void;
  onContextMenu: (nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) => void;
  onChange: (node: IFileTreeItemRendered, value: string) => void;
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
  files: IFileTreeItem[] = [];

  @observable.shallow
  status: IFileTreeItemStatus = new Map();

  private _root: FileStat | undefined;

  private fileServiceWatchers: {
    [uri: string]: IFileServiceWatcher,
  } = {};

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired()
  private fileAPI: FileTreeAPI;

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

  private statusChangeEmitter = new Emitter<Uri[]>();

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

  get isFocused(): boolean {
    for (const [key, status] of this.status) {
      if (status.focused) {
        return true;
      }
    }
    return false;
  }

  get isSelected(): boolean {
    for (const [key, status] of this.status) {
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
    for (const [key, status] of this.status) {
      if (status.focused) {
        focused.push(status.file.uri);
      }
    }
    return focused;
  }

  get selectedUris(): URI[] {
    const selected: URI[] = [];
    for (const [key, status] of this.status) {
      if (status.selected) {
        selected.push(status.file.uri);
      }
    }
    return selected;
  }

  get selectedFiles(): IFileTreeItem[] {
    const selected: IFileTreeItem[] = [];
    for (const [key, status] of this.status) {
      if (status.selected) {
        selected.push(status.file);
      }
    }
    return selected;
  }

  get focusedFiles(): IFileTreeItem[] {
    const selected: IFileTreeItem[] = [];
    for (const [key, status] of this.status) {
      if (status.focused) {
        selected.push(status.file);
      }
    }
    return selected;
  }

  getStatutsKey(file: IFileTreeItem | string | URI) {
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
    return file.filestat.uri + (file.filestat.isSymbolicLink ? '#' : '');
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
      return status.file.children;
    }
  }

  @action
  async effectChange(files: FileChange[]) {
    for (const file of files) {
      let parent: IFileTreeItem;
      let parentFolder: URI | boolean;
      let parentStatusKey: string;
      switch (file.type) {
        case (FileChangeType.UPDATED):
          break;
        case (FileChangeType.ADDED):
          // 表示已存在相同文件，不新增文件
          if (this.status.has(file.uri)) {
            break;
          }
          parentFolder = new URI(file.uri);
          parentStatusKey = this.getStatutsKey(parentFolder);
          let parentStatus = this.status.get(parentStatusKey);
          if (!parentStatus) {
            parentFolder = parentFolder.parent;
            parentStatusKey = this.getStatutsKey(parentFolder);
            parentStatus = this.status.get(parentStatusKey);
          }
          if (!parentStatusKey) {
            return;
          }
          // 父节点还未引入，不更新
          if (!parentStatus) {
            break;
          }
          parent = parentStatus!.file as IFileTreeItem;
          // 父节点文件不存在或者已引入，待更新
          if (!parent) {
            break;
          }
          // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
          if (!parentStatus!.expanded) {
            this.status.set(parentStatusKey, {
              ...parentStatus!,
              needUpdated: true,
            });
            break;
          }
          const filestat = await this.fileAPI.getFileStat(file.uri);
          if (!filestat) {
            // 文件不存在，直接结束
            return;
          }
          const target: IFileTreeItem = this.fileAPI.generatorFileFromFilestat(filestat, parent);
          if (target.filestat.isDirectory) {
            this.status.set(file.uri.toString(), {
              selected: false,
              focused: false,
              expanded: false,
              needUpdated: true,
              file: target,
            });
          } else {
            this.status.set(file.uri.toString(), {
              selected: false,
              focused: false,
              file: target,
            });
          }
          parent.children.push(target);
          parent.children = this.fileAPI.sortByNumberic(parent.children);
          this.status.set(parentStatusKey, {
            ...this.status.get(parentStatusKey)!,
            file: parent,
          });
          break;
        case (FileChangeType.DELETED):
          const status = this.status.get(file.uri);
          if (!status) {
            break;
          }
          parent = status && status.file!.parent as IFileTreeItem;
          if (!parent) {
            break;
          }
          parentFolder = parent.uri;
          parentStatusKey = this.getStatutsKey(parentFolder);
          // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
          if (!this.status.get(parentStatusKey)!.expanded) {
            this.status.set(parentStatusKey, {
              ...this.status.get(parentStatusKey)!,
              needUpdated: true,
            });
            break;
          }
          for (let i = parent.children.length - 1; i >= 0; i--) {
            if (parent.children[i].uri.toString() === file.uri) {
              runInAction(() => {
                parent.children.splice(i, 1);
                this.status.delete(file.uri);
              });
              break;
            }
          }
          break;
        default:
          break;
      }
    }
  }

  @action
  async createFile(node: IFileTreeItem, newName: string, isDirectory: boolean = false) {
    const uri = node.uri;
    this.removeStatusAndFileFromParent(uri);
    if (newName === TEMP_FILE_NAME) {
      return;
    }
    const exist = await this.fileAPI.exists(uri);
    if (!exist) {
      if (isDirectory) {
        await this.fileAPI.createFolder(this.replaceFileName(uri, newName));
      } else {
        await this.fileAPI.createFile(this.replaceFileName(uri, newName));
      }
    }
  }

  @action
  async createFolder(node: IFileTreeItem, newName: string) {
    await this.createFile(node, newName, true);
  }

  /**
   * 从status及files里移除资源
   * @param uri
   */
  @action
  removeStatusAndFileFromParent(uri: URI) {
    const statusKey = this.getStatutsKey(uri);
    const status = this.status.get(statusKey);
    const parent = status && status.file!.parent as IFileTreeItem;
    if (parent) {
      const parentStatusKey = this.getStatutsKey(parent);
      // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
      if (!this.status.get(parentStatusKey)!.expanded) {
        this.status.set(parentStatusKey, {
          ...this.status.get(parentStatusKey)!,
          needUpdated: true,
        });
      } else {
        for (let i = parent.children.length - 1; i >= 0; i--) {
          if (parent.children[i].uri.isEqual(uri)) {
            parent.children.splice(i, 1);
            this.status.delete(this.getStatutsKey(uri));
            break;
          }
        }
      }
    }
  }

  @action
  removeTempStatus() {
    for (const [ , status] of this.status) {
      if (status && status.file && status.file.name === TEMP_FILE_NAME) {
        this.removeStatusAndFileFromParent(status.file.uri);
        break;
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
      if (status && status.file && status.file!.filestat.isDirectory && !status.file!.filestat.isTemporaryFile) {
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
    const parent = parentStatus.file;
    const tempfile: IFileTreeItem = isDirectory ? this.fileAPI.generatorTempFolder(tempFileUri, parent) : this.fileAPI.generatorTempFile(tempFileUri, parent);
    const tempFileStatusKey = tempFileUri.toString();
    this.status.set(tempFileStatusKey, {
      selected: false,
      focused: false,
      file: tempfile,
    });
    parent.children.push(tempfile);
    parent.children = this.fileAPI.sortByNumberic(parent.children);
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
    this.status.set(statusKey, {
      ...status,
      file: {
        ...status.file,
        filestat: {
          ...status.file.filestat,
          isTemporaryFile: true,
        },
      },
    });
  }

  async renameFile(node: IFileTreeItem, value: string) {
    if (value && value !== node.name) {
      await this.fileAPI.moveFile(node.uri, this.replaceFileName(node.uri, value));
    }
    const statusKey = this.getStatutsKey(node);
    const status = this.status.get(statusKey);
    if (!status) {
      return;
    }
    this.status.set(statusKey, {
      ...status,
      file: {
        ...status.file,
        filestat: {
          ...status.file.filestat,
          isTemporaryFile: false,
        },
      },
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
    const status = this.status.get(toStatusKey);
    this.resetFilesSelectedStatus();
    if (from.isEqual(to) && status) {
      this.status.set(toStatusKey, {
        ...status,
        focused: true,
      });
      // 路径相同，不处理
      return;
    }
    if (this.corePreferences['explorer.confirmMove']) {
      const ok = localize('explorer.comfirm.move.ok');
      const cancel = localize('explorer.comfirm.move.cancel');
      const comfirm = await this.dislogService.warning(formatLocalize('explorer.comfirm.move', from.displayName, targetDir.displayName), [cancel, ok]);
      if (comfirm !== ok) {
        return;
      }
    }
    if (status) {
      // 如果已存在该文件，提示是否替换文件
      const ok = localize('explorer.comfirm.replace.ok');
      const cancel = localize('explorer.comfirm.replace.cancel');
      const comfirm = await this.dislogService.warning(formatLocalize('explorer.comfirm.replace', from.displayName, targetDir.displayName), [cancel, ok]);
      if (comfirm !== ok) {
        return;
      } else {
        await this.fileAPI.moveFile(from, to);
        this.status.set(toStatusKey, {
          ...status,
          focused: true,
        });
      }
    } else {
      await this.fileAPI.moveFile(from, to);
    }
  }

  async deleteFiles(uris: URI[]) {
    if (this.corePreferences['explorer.confirmDelete']) {
      const ok = localize('explorer.comfirm.delete.ok');
      const cancel = localize('explorer.comfirm.delete.cancel');
      const deleteFilesMessage = `[${uris.map((uri) => uri.displayName).join(',')}]`;
      const comfirm = await this.dislogService.warning(formatLocalize('explorer.comfirm.delete', deleteFilesMessage), [cancel, ok]);
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
          expanded: false,
        });
      }
    } else {
      const statusKey = this.getStatutsKey(uri.toString());
      const status = this.status.get(statusKey);
      let children: IFileTreeItem[] = [];
      if (status && status.file) {
        children = status.file.children;
      }
      if (children && children.length > 0) {
        children.forEach((child) => {
          if (child.filestat.isDirectory) {
            const childPath = this.getStatutsKey(child.uri.toString());
            this.status.set(childPath, {
              ...this.status.get(childPath)!,
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
  refresh(uri: URI) {
    const statusKey = this.getStatutsKey(uri);
    const status = this.status.get(statusKey);
    if (!status) {
      return;
    }
    if (status.file.filestat.isDirectory) {
      this.status.set(statusKey, {
        ...status,
        needUpdated: true,
      });
      if (status.expanded) {
        this.refreshExpandedFile(status.file);
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
  updateFilesSelectedStatus(files: IFileTreeItem[], value: boolean) {
    if (files.length === 0) {
      this.resetFilesFocusedStatus();
    } else {
      this.resetFilesSelectedStatus();
      files.forEach((file: IFileTreeItem) => {
        const uri = this.getStatutsKey(file);
        this.status.set(uri, {
          ...this.status.get(uri),
          selected: value,
          focused: value,
          file,
        });
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
   * 焦点事件与选中事件不冲突，可同时存在
   * 选中为A，焦点为B的情况
   * @param file
   * @param value
   */
  @action
  updateFilesFocusedStatus(files: IFileTreeItem[], value: boolean) {
    this.resetFilesFocusedStatus();
    files.forEach((file: IFileTreeItem) => {
      const uri = this.getStatutsKey(file);
      this.status.set(uri, {
        ...this.status.get(uri)!,
        focused: value,
      });
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

  @action
  async refreshExpandedFile(file: IFileTreeItem) {
    const statusKey = this.getStatutsKey(file);
    const status = this.status.get(statusKey);
    if (file.filestat.isDirectory) {
      if (!file.parent) {
        const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.filestat, file.parent);
        const children = file.children = files[0].children;
        children.forEach((child) => {
          const childStatusKey = this.getStatutsKey(child);
          const childStatus = this.status.get(childStatusKey);
          if (childStatus && childStatus.expanded) {
            this.status.set(childStatusKey, {
              ...childStatus!,
              file: child,
            });
            this.refreshExpandedFile(child);
          }
        });
        this.updateFileStatus(files, this.status);
        // 更新files引用
        if (!this.isMutiWorkspace) {
          this.files = [file];
        }
      } else if (file.children.length === 0 && file.parent || status && status.needUpdated && file.parent) {
        // 如果当前目录下的子文件为空，同时具备父节点，尝试调用fileservice加载文件
        // 如果当前目录具备父节点(即非根目录)，尝试调用fileservice加载文件
        for (let i = 0, len = file.parent!.children.length; i < len; i++) {
          if (file.uri.isEqual(file.parent!.children[i].uri)) {
            const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.filestat, file.parent);
            const children = file.parent!.children[i].children = files[0].children;
            children.forEach((child) => {
              const childStatusKey = this.getStatutsKey(child);
              const childStatus = this.status.get(childStatusKey);
              if (childStatus && childStatus.expanded) {
                this.status.set(childStatusKey, {
                  ...childStatus!,
                  file: child,
                });
                this.refreshExpandedFile(child);
              }
            });
            // 子元素继承旧状态
            this.updateFileStatus(files, this.status);
            break;
          }
        }
      }
    }
  }

  @action
  async updateFilesExpandedStatus(file: IFileTreeItem) {
    const statusKey = this.getStatutsKey(file);
    const status = this.status.get(statusKey);
    if (file.filestat.isDirectory) {
      if (status && !status.expanded) {
        // 如果当前目录下的子文件为空，同时具备父节点，尝试调用fileservice加载文件
        // 如果当前目录具备父节点(即非根目录)，尝试调用fileservice加载文件
        if (file.children.length === 0 && file.parent || status && status.needUpdated && file.parent) {
          for (let i = 0, len = file.parent!.children.length; i < len; i++) {
            if (file.parent!.children[i].id === file.id) {
              const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.filestat, file.parent);
              this.updateFileStatus(files);
              file.parent!.children[i].children = files[0].children;
              break;
            }
          }
        }
        this.status.set(statusKey, {
          ...status!,
          expanded: true,
          focused: true,
          selected: true,
          needUpdated: false,
        });
      } else {
        this.status.set(statusKey, {
          ...status!,
          expanded: false,
          focused: true,
          selected: true,
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
  updateFileStatus(files: IFileTreeItem[], statusMap?: IFileTreeItemStatus) {
    const changeUri: Uri[] = [];
    files.forEach((file: IFileTreeItem) => {
      const uri = this.getStatutsKey(file);
      const status = statusMap ? statusMap.get(uri) : false;
      if (file.children && file.children.length > 0) {
        if (status) {
          this.status.set(uri, {
            ...status,
            file,
          });
        } else {
          this.status.set(uri, {
            selected: false,
            focused: false,
            expanded: true,
            file,
          });
        }
        this.updateFileStatus(file.children, statusMap);
      } else {
        const status = statusMap ? statusMap.get(uri) : false;
        if (status) {
          this.status.set(uri, {
            ...status,
            file,
          });
        } else {
          this.status.set(uri, {
            selected: false,
            focused: false,
            expanded: false,
            file,
          });
        }
      }
      changeUri.push(Uri.parse(uri));
    });
    this.statusChangeEmitter.fire(changeUri);
  }

  @action
  private async getFiles(roots: IWorkspaceRoots): Promise<IFileTreeItem[]> {
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
      watcher.onFilesChanged((files: FileChange[]) => {
        this.effectChange(files);
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
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true });
  }

  /**
   * 打开并固定文件
   * @param uri
   */
  openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: false });
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
}
