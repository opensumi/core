import { observable, runInAction, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  WithEventBus,
  CommandService,
  ContextKeyService,
  URI,
  IDisposable,
  isWindows,
} from '@ali/ide-core-browser';
import { FileTreeAPI, IFileTreeItem, IFileTreeItemStatus } from '../common';
import { AppConfig } from '@ali/ide-core-browser';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileChange, FileChangeType } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItemRendered } from './file-tree.view';

// windows下路径查找时分隔符为 \
export const FILE_SLASH_FLAG = isWindows ? '\\' : '/';

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

@Injectable()
export class FileTreeService extends WithEventBus {

  @observable.shallow
  files: IFileTreeItem[] = [];

  @observable.shallow
  status: IFileTreeItemStatus = {};

  // 该计数器用于强制更新视图
  // 添加Object Deep监听性能太差
  @observable
  key: number = 0;

  private fileServiceWatchers: {
    [uri: string]: IDisposable,
  } = {};

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired()
  private fileServiceClient: FileServiceClient;

  @Autowired(ContextKeyService)
  contextKeyService: ContextKeyService;

  filesExplorerFocusedContext;

  constructor(
  ) {
    super();
    this.init();
  }

  get isFocused(): boolean {
    for (const uri of Object.keys(this.status)) {
      if (this.status[uri].focused) {
        return true;
      }
    }
    return false;
  }

  get isSelected(): boolean {
    for (const uri of Object.keys(this.status)) {
      if (this.status[uri].selected) {
        return true;
      }
    }
    return false;
  }

  get root(): URI {
    return URI.file(this.config.workspaceDir);
  }

  getParent(uri: URI) {
    if (this.status[uri.toString()]) {
      return this.status[uri.toString()].file.parent;
    }
  }

  getChildren(uri: URI) {
    if (this.status[uri.toString()]) {
      return this.status[uri.toString()].file.children;
    }
  }

  getSelectedFileItem(): URI[] {
    const result: URI[] = [];
    for (const uri of Object.keys(this.status)) {
      if (this.status[uri].selected) {
        result.push(this.status[uri].file.uri);
      }
    }
    return result;
  }

  async init() {
    await this.getFiles(this.root.toString());
    this.fileServiceClient.onFilesChanged((files: FileChange[]) => {
      runInAction(async () => {
        for (const file of files) {
          let parent: IFileTreeItem;
          let parentFolder: string;
          switch (file.type) {
            case (FileChangeType.UPDATED):
            break;
            case (FileChangeType.ADDED):
              // 表示已存在相同文件，不新增文件
              if (this.status[file.uri.toString()]) {
                break;
              }
              parentFolder = this.getFileParent(file.uri, (path: string) => {
                if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
                  return true;
                } else {
                  return false;
                }
              });
              // 父节点还未引入，不更新
              if (!this.status[parentFolder]) {
                break;
              }
              parent = this.status[parentFolder].file as IFileTreeItem;
              // 父节点文件不存在或者已引入，待更新
              if (!parent) {
                break;
              }
              // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
              if (!this.status[parentFolder].expanded) {
                this.status[parentFolder] = {
                  ...this.status[parentFolder],
                  needUpdated: true,
                };
                break;
              }
              const filestat = await this.fileAPI.getFileStat(file.uri);
              const target: IFileTreeItem = await this.fileAPI.generatorFileFromFilestat(filestat, parent);
              if (target.filestat.isDirectory) {
                this.status[file.uri.toString()] = {
                  selected: false,
                  focused: false,
                  expanded: false,
                  needUpdated: true,
                  file: target,
                };
              } else {
                this.status[file.uri.toString()] = {
                  selected: false,
                  focused: false,
                  file: target,
                };
              }
              parent.children.push(target);
              parent.children = this.fileAPI.sortByNumberic(parent.children);
              break;
            case (FileChangeType.DELETED):
              parent = this.status[file.uri] && this.status[file.uri].file!.parent as IFileTreeItem;
              if (!parent) {
                break;
              }
              parentFolder = parent.uri.toString();
              // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
              if (!this.status[parentFolder].expanded) {
                this.status[parentFolder] = {
                  ...this.status[parentFolder],
                  needUpdated: true,
                };
                break;
              }
              for (let i = parent.children.length - 1; i >= 0; i--) {
                if (parent.children[i].uri.toString() === file.uri) {
                  runInAction(() => {
                    parent.children.splice(i, 1);
                    delete this.status[file.uri];
                  });
                  break;
                }
              }
              break;
            default:
              break;
          }
        }
        // 用于强制更新视图
        // 添加Object Deep监听性能太差
        this.key ++;
      });
    });
  }

  @action
  async createFile(node: IFileTreeItem, newName: string) {
    const uri = node.uri.toString();
    this.removeStatusAndFileFromParent(uri);
    await this.fileAPI.createFile(this.replaceFileName(uri, newName));
  }

  @action
  async createFileFolder(node: IFileTreeItem, newName: string) {
    const uri = node.uri.toString();
    this.removeStatusAndFileFromParent(uri);
    await this.fileAPI.createFileFolder(this.replaceFileName(uri, newName));
  }

  /**
   * 从status及files里移除资源
   * @param uri
   */
  removeStatusAndFileFromParent(uri: string) {
    const parent = this.status[uri] && this.status[uri].file!.parent as IFileTreeItem;
    if (parent) {
      const parentFolder = parent.uri.toString();
      // 当父节点为未展开状态时，标记其父节点待更新，处理下个文件
      if (!this.status[parentFolder].expanded) {
        this.status[parentFolder] = {
          ...this.status[parentFolder],
          needUpdated: true,
        };
      }
      for (let i = parent.children.length - 1; i >= 0; i--) {
        if (parent.children[i].uri.toString() === uri) {
          runInAction(() => {
            parent.children.splice(i, 1);
            delete this.status[uri];
          });
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
  async createTempFile(uri: string) {
    const parentFolder = this.searchFileParent(uri, (path: string) => {
      if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
        return true;
      } else {
        return false;
      }
    });
    const tempFileName = `${parentFolder}${FILE_SLASH_FLAG}${TEMP_FILE_NAME}`;
    const parent = this.status[parentFolder].file;
    const tempfile: IFileTreeItem = await this.fileAPI.generatorTempFile(tempFileName, parent);
    const target = this.status[uri];
    if (target.file.filestat.isDirectory && !target.expanded) {
      await this.updateFilesExpandedStatus(target.file);
    }
    this.status[tempFileName] = {
      selected: false,
      focused: false,
      file: tempfile,
    };
    parent.children.push(tempfile);
    parent.children = this.fileAPI.sortByNumberic(parent.children);
    this.key ++;
  }

  /**
   * 创建临时文件夹
   * @param uri
   */
  @action
  async createTempFileFolder(uri: string) {
    const parentFolder = this.searchFileParent(uri, (path: string) => {
      if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
        return true;
      } else {
        return false;
      }
    });
    const tempFileName = `${parentFolder}${FILE_SLASH_FLAG}${TEMP_FILE_NAME}`;
    const parent = this.status[parentFolder].file;
    const tempfile: IFileTreeItem = await this.fileAPI.generatorTempFileFolder(tempFileName, parent);
    const target = this.status[uri];
    if (target.file.filestat.isDirectory && !target.expanded) {
      await this.updateFilesExpandedStatus(target.file);
    }
    this.status[tempFileName] = {
      selected: false,
      focused: false,
      file: tempfile,
    };
    parent.children.push(tempfile);
    parent.children = this.fileAPI.sortByNumberic(parent.children);
    this.key ++;
  }

  /**
   * 创建临时文件用于重命名
   * @param uri
   */
  @action
  async renameTempFile(uri: URI) {
    this.status[uri.toString()].file.filestat = {
      ...this.status[uri.toString()].file.filestat,
      isTemporaryFile: true,
    };
    this.key ++;
  }

  async renameFile(node: IFileTreeItem, value: string) {
    if (value && value !== node.name) {
      await this.fileAPI.moveFile(node.uri.toString(), this.replaceFileName(node.uri.toString(), value));
    }
    this.status[node.uri.toString()].file.filestat = {
      ...this.status[node.uri.toString()].file.filestat,
      isTemporaryFile: false,
    };
    this.key ++;
  }

  async deleteFile(uri: URI) {
    await this.fileAPI.deleteFile(uri);
  }

  async moveFile(from: string, targetDir: string) {
    const sourcePieces = from.split(FILE_SLASH_FLAG);
    const sourceName = sourcePieces[sourcePieces.length - 1];
    const to = `${targetDir}${FILE_SLASH_FLAG}${sourceName}`;
    this.resetFilesSelectedStatus();
    if (from === to) {
      this.status[to] = {
        ...this.status[to],
        focused: true,
      };
      // 路径相同，不处理
      return ;
    }
    if (this.status[to]) {
      // 如果已存在该文件，提示是否替换文件
      const replace = confirm(`是否替换文件${sourceName}`);
      if (replace) {
        await this.fileAPI.moveFile(from, to);
        this.status[to] = {
          ...this.status[to],
          focused: true,
        };
      }
    } else {
      await this.fileAPI.moveFile(from, to);
    }
  }

  async deleteFiles(uris: URI[]) {
    uris.forEach(async (uri: URI) => {
      await this.fileAPI.deleteFile(uri);
    });
  }

  /**
   * 折叠所有节点
   */
  @action
  collapseAll(uri?: URI) {
    if (!uri) {
      for (const uri of Object.keys(this.status)) {
        this.status[uri] = {
          ...this.status[uri],
          expanded: false,
        };
      }
    } else {
      const children = this.status[uri.toString()].file.children;
      if (children && children.length > 0) {
        children.forEach((child) => {
          if (child.filestat.isDirectory) {
            this.status[child.filestat.uri] = {
              ...this.status[child.filestat.uri],
              expanded: false,
              needUpdated: true,
            };
          }
        });
      }
    }
  }

  /**
   * 刷新所有节点
   */
  @action
  refreshAll(uri: URI) {
    console.log(uri);
    const path = uri.toString();
    if (this.status[path].file.filestat.isDirectory) {
      this.status[path] = {
        ...this.status[path],
        needUpdated: true,
      };
      if (this.status[path].expanded) {
        this.refreshExpandedFile(this.status[path].file);
      }
    }
    const children = this.status[path].file.children;
    if (children && children.length > 0) {
      children.forEach((child) => {
        if (child.filestat.isDirectory) {
          if (this.status[child.uri.toString()].expanded) {
            this.refreshAll(child.uri);
          } else {
            this.status[child.filestat.uri] = {
              ...this.status[child.filestat.uri],
              needUpdated: true,
            };
          }
        }
      });
    }
  }

  searchFileParent(uri: string, check: any) {
    const uriPathArray = uri.split(FILE_SLASH_FLAG);
    let len = uriPathArray.length;
    let parent;
    while ( len ) {
      parent = uriPathArray.slice(0, len).join(FILE_SLASH_FLAG);
      if (check(parent)) {
        return parent;
      }
      len--;
    }
    return false;
  }

  replaceFileName(uri: string, name: string) {
    const uriPathArray = uri.split(FILE_SLASH_FLAG);
    uriPathArray.pop();
    uriPathArray.push(name);
    return uriPathArray.join(FILE_SLASH_FLAG);
  }

  getFileParent(uri: string, check: any) {
    const uriPathArray = uri.split(FILE_SLASH_FLAG);
    const len = uriPathArray.length;
    let parent;
    parent = uriPathArray.slice(0, len - 1).join(FILE_SLASH_FLAG);
    if (check(parent)) {
      return parent;
    }
    return false;
  }

  /**
   * 当选中事件激活时同时也为焦点事件
   * 需要同时设置seleted与focused
   * @param file
   * @param value
   */
  updateFilesSelectedStatus(files: IFileTreeItem[], value: boolean) {
    this.resetFilesSelectedStatus();
    files.forEach((file: IFileTreeItem) => {
      const uri = file.uri.toString();
      this.status[uri] = {
        ...this.status[uri],
        selected: value,
        focused: value,
      };
    });
  }

  /**
   * 重置所有文件Selected属性
   */
  resetFilesSelectedStatus() {
    const uris = Object.keys(this.status);
    for (const i of uris) {
      this.status[i] = {
        ...this.status[i],
        selected: false,
        focused: false,
      };
    }
  }

  /**
   * 焦点事件与选中事件不冲突，可同时存在
   * 选中为A，焦点为B的情况
   * @param file
   * @param value
   */
  updateFilesFocusedStatus(files: IFileTreeItem[], value: boolean) {
    this.resetFilesFocusedStatus();
    files.forEach((file: IFileTreeItem) => {
      const uri = file.uri.toString();
      this.status[uri] = {
        ...this.status[uri],
        focused: value,
      };
    });
  }

  /**
   * 重置所有文件Focused属性
   */
  resetFilesFocusedStatus() {
    const uris = Object.keys(this.status);
    for (const i of uris) {
      this.status[i] = {
        ...this.status[i],
        focused: false,
      };
    }
  }

  @action
  async refreshExpandedFile(file: IFileTreeItem) {
    const uri = file.uri.toString();
    if (file.filestat.isDirectory) {
      // 如果当前目录下的子文件为空，同时具备父节点，尝试调用fileservice加载文件
      // 如果当前目录具备父节点(即非根目录)，尝试调用fileservice加载文件
      if (file.children.length === 0 && file.parent || this.status[uri] && this.status[uri].needUpdated && file.parent) {
        for (let i = 0, len = file.parent!.children.length; i < len; i++) {
          if (file.parent!.children[i].id === file.id) {
            const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.filestat.uri, file.parent);
            // 子元素继承旧状态
            console.log(files, Object.assign({}, this.status));
            this.updateFileStatus(files, Object.assign({}, this.status));
            file.parent!.children[i].children = files[0].children;
            break;
          }
        }
      }
    }
  }

  @action
  async updateFilesExpandedStatus(file: IFileTreeItem) {
    const uri = file.uri.toString();
    if (file.filestat.isDirectory) {
      if (!file.expanded) {
        // 如果当前目录下的子文件为空，同时具备父节点，尝试调用fileservice加载文件
        // 如果当前目录具备父节点(即非根目录)，尝试调用fileservice加载文件
        if (file.children.length === 0 && file.parent || this.status[uri] && this.status[uri].needUpdated && file.parent) {
          for (let i = 0, len = file.parent!.children.length; i < len; i++) {
            if (file.parent!.children[i].id === file.id) {
              const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.filestat.uri, file.parent);
              this.updateFileStatus(files);
              file.parent!.children[i].children = files[0].children;
              break;
            }
          }
        }
        this.status[uri] = {
          ...this.status[uri],
          expanded: true,
          focused: true,
          selected: true,
          needUpdated: false,
        };
      } else {
        this.status[uri] = {
          ...this.status[uri],
          expanded: false,
          focused: true,
          selected: true,
        };
      }
    }
  }

  @action
  updateFileStatus(files: IFileTreeItem[], status?: IFileTreeItemStatus) {
    files.forEach((file: IFileTreeItem, index: number) => {
      const uri = file.filestat.uri.toString();
      if (file.children && file.children.length > 0) {
        if (status) {
          this.status[uri] = {
            ...status[uri],
            file,
          };
        } else {
          this.status[uri] = {
            selected: false,
            focused: false,
            expanded: true,
            file,
          };
        }
        this.updateFileStatus(file.children, status);
      } else {
        if (status) {
          this.status[uri] = {
            ...status[uri],
            file,
          };
        } else {
          this.status[uri] = {
            selected: false,
            focused: false,
            expanded: false,
            file,
          };
        }
      }
    });
  }

  private async getFiles(path: string): Promise<IFileTreeItem[]> {
    const files = await this.fileAPI.getFiles(path);
    // 在一次mobx数据提交中执行赋值操作
    runInAction(() => {
      this.updateFileStatus(files);
      this.files = files;
    });
    this.fileServiceWatchers[path] = await this.fileServiceClient.watchFileChanges(new URI(path));
    return files;
  }

  // 打开文件
  openFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_BROWSER_COMMANDS.openResource, uri);
  }

  // 打开并固定文件
  openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_BROWSER_COMMANDS.openResource, uri);
  }

  // 比较选中的
  compare(original: URI, modified: URI) {
    this.commandService.executeCommand(EDITOR_BROWSER_COMMANDS.compare, {
      original,
      modified,
    });
  }
}
