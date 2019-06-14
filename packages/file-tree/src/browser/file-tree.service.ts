import { observable, runInAction, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { FileTreeAPI, IFileTreeItem, IFileTreeItemStatus } from '../common';
import { CommandService, URI, IDisposable, isWindows } from '@ali/ide-core-common';
import { ResizeEvent } from '@ali/ide-main-layout/lib/browser/ide-widget.view';
import { SlotLocation } from '@ali/ide-main-layout';
import { AppConfig, Logger } from '@ali/ide-core-browser';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';
import { IFileTreeItemRendered } from './file-tree.view';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileChange, FileChangeType } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';

// windows下路径查找时分隔符为 \
export const FILE_SLASH_FLAG = isWindows ? '\\' : '/';

@Injectable()
export default class FileTreeService extends WithEventBus {

  @observable.shallow
  files: IFileTreeItem[] = [];

  @observable.shallow
  status: IFileTreeItemStatus = {};

  @observable
  renderedStart: number;

  // 该计数器用于强制更新视图
  // 添加Object Deep监听性能太差
  @observable
  refreshNodes: number = 0;

  @observable
  layout: any = {
    width: 300,
    height: '100%',
  };

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

  @Autowired(Logger)
  private logger: Logger;

  constructor(
  ) {
    super();
    this.init();
  }

  async init() {
    const workspaceDir = URI.file(this.config.workspaceDir).toString();
    this.renderedStart = 0;
    await this.getFiles(workspaceDir);
    this.fileServiceClient.onFilesChanged(async (files: FileChange[]) => {
      for (const file of files) {
        let parent: IFileTreeItem;
        switch (file.type) {
          case (FileChangeType.UPDATED):
          break;
          case (FileChangeType.ADDED):
            // 表示已存在相同文件，不新增文件
            if (this.status[file.uri.toString()] && !this.status[file.uri.toString()].deleted) {
              break;
            }
            const parentFolder = this.searchFileParent(file.uri, (path: string) => {
              if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
                return true;
              } else {
                return false;
              }
            });
            parent = this.status[parentFolder].file as IFileTreeItem;
            const filestat = await this.fileAPI.getFileStat(file.uri);
            const target: IFileTreeItem = await this.fileAPI.generatorFile(filestat, parent);
            parent.children.push(target);
            parent.children = this.fileAPI.sortByNumberic(parent.children);
            this.status[file.uri.toString()] = {
              selected: false,
              focused: false,
              expanded: false,
              file: target,
            };
            break;
          case (FileChangeType.DELETED):
            parent = this.status[file.uri] && this.status[file.uri].file!.parent as IFileTreeItem;
            if (!parent) {
              break;
            }
            for (let i = parent.children.length - 1; i >= 0; i--) {
              if (parent.children[i].uri.toString() === file.uri) {
                parent.children.splice(i, 1);
                this.status[file.uri] = {
                  ...this.status[file.uri],
                  deleted: true,
                };
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
      this.refreshNodes ++;
    });
  }

  async createFile(uri: string) {
    const parentFolder = this.searchFileParent(uri, (path: string) => {
      if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
        return true;
      } else {
        return false;
      }
    });
    let fileIndex = 0;
    while (this.status[`${parentFolder}${FILE_SLASH_FLAG}Untitled${fileIndex ? `_${fileIndex}` : ''}.txt`]) {
      fileIndex ++;
    }
    await this.updateFilesExpandedStatus(this.status[parentFolder].file);
    const newFileName = prompt('新建文件', `Untitled${fileIndex ? `_${fileIndex}` : ''}.txt`);
    if (!!newFileName) {
      await this.fileAPI.createFile(`${parentFolder}${FILE_SLASH_FLAG}${newFileName}`);
    }
  }

  async createFileFolder(uri: string) {
    const parentFolder = this.searchFileParent(uri, (path: string) => {
      if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
        return true;
      } else {
        return false;
      }
    });
    let fileIndex = 0;
    while (this.status[`${parentFolder}${FILE_SLASH_FLAG}Untitled${fileIndex ? `_${fileIndex}` : ''}`]) {
      fileIndex ++;
    }
    await this.updateFilesExpandedStatus(this.status[parentFolder].file);
    const newFolderName = prompt('新建文件夹', `Untitled${fileIndex ? `_${fileIndex}` : ''}`);
    if (!!newFolderName) {
      await this.fileAPI.createFileFolder(`${parentFolder}${FILE_SLASH_FLAG}${newFolderName}`);
    }
  }

  async renameFile(uri: string) {
    const parentFolder = this.searchFileParent(uri, (path: string) => {
      if (this.status[path] && this.status[path].file && this.status[path].file!.filestat.isDirectory) {
        return true;
      } else {
        return false;
      }
    });
    const newFileName = prompt('重命名', `${uri.replace(parentFolder + FILE_SLASH_FLAG, '')}`);
    await this.fileAPI.moveFile(uri, `${parentFolder}${FILE_SLASH_FLAG}${newFileName}`);
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
    if (this.status[to] && !this.status[to].deleted) {
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

  resetFilesFocusedStatus() {
    const uris = Object.keys(this.status);
    for (const i of uris) {
      this.status[i] = {
        ...this.status[i],
        focused: false,
      };
    }
  }

  async updateFilesExpandedStatus(file: IFileTreeItem) {
    const uri = file.uri.toString();
    if (file.filestat.isDirectory) {
      if (!file.expanded) {
        runInAction(async () => {
          // 如果当前目录下的子文件为空，同时具备父节点，尝试调用fileservice加载文件
          if (file.children.length === 0 && file.parent) {
            for (let i = 0, len = file.parent!.children.length; i < len; i++) {
              if ( file.parent!.children[i].id === file.id) {
                const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.filestat.uri, file.parent!.children[i]);
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
          };
        });
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

  updateRenderedStart(value: number) {
    this.renderedStart = value;
  }

  updateFileStatus(files: IFileTreeItem[]) {
    files.forEach((file: IFileTreeItem, index: number) => {
      const uri = file.filestat.uri.toString();
      if (file.children && file.children.length > 0) {
        this.status[uri] = {
          selected: false,
          focused: false,
          expanded: true,
          file,
        };
        this.updateFileStatus(file.children);
      } else {
        this.status[uri] = {
          selected: false,
          focused: false,
          expanded: false,
          file,
        };
      }
    });
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === SlotLocation.activatorPanel) {
      this.layout = e.payload;
    }
  }

  private async getFiles(path: string): Promise<IFileTreeItem[]> {
    const files = await this.fileAPI.getFiles(path);
    // 在一次mobx数据提交中执行赋值操作
    runInAction(() => {
      this.updateFileStatus(files);
      this.files = files;
    });
    if (files[0].children.length > 0) {
      this.fileServiceWatchers[path] = await this.fileServiceClient.watchFileChanges(new URI(path));
    }
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
}
