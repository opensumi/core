import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { FileTreeAPI, IFileTreeItem, IFileTreeItemStatus } from '../common';
import { CommandService, URI, IDisposable } from '@ali/ide-core-common';
import { ResizeEvent } from '@ali/ide-main-layout/lib/browser/ide-widget.view';
import { SlotLocation } from '@ali/ide-main-layout';
import { AppConfig } from '@ali/ide-core-browser';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';
import { IFileTreeItemRendered } from './file-tree.view';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { DidFilesChangedParams, FileChange } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';

@Injectable()
export default class FileTreeService extends WithEventBus {

  @observable.shallow
  files: IFileTreeItem[] = [];

  @observable.shallow
  status: IFileTreeItemStatus = {};

  @observable
  renderedStart: number;

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

  constructor(
  ) {
    super();
    this.init();
  }

  async init() {
    const files = await this.getFiles();
    this.updateFileStatus(files);
    this.fileServiceClient.onFilesChanged((fileChange: FileChange[]) => {
      console.log(fileChange, ' fileServiceClient');
    });
    this.renderedStart = 0;
  }

  createFile = async () => {
    // 调用示例
    // const {content} = await this..resolveContent('/Users/franklife/work/ide/ac/ide-framework/tsconfig.json');
    // console.log('content', content);

    // 只会执行注册在 Module 里声明的 Contribution
    this.commandService.executeCommand('file.tree.console');
  }

  updateFilesSelectedStatus(file: IFileTreeItem, value: boolean) {
    const uri = file.uri.toString();
    const uris = Object.keys(this.status);
    for (const i of uris) {
      this.status[i].selected = false;
    }
    this.status[uri] = {
      ...this.status[uri],
      selected: value,
    };
  }

  async updateFilesExpandedStatus(file: IFileTreeItemRendered) {
    const uri = file.uri.toString();
    if (file.filestat.isDirectory) {
      if (!file.expanded) {
        // 如果当前目录下的子文件为空，尝试调用fileservice加载文件
        if (file.children.length === 0) {
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
        };
      } else {
        this.status[uri] = {
          ...this.status[uri],
          expanded: false,
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
        };
        this.updateFileStatus(file.children);
      } else {
        this.status[uri] = {
          selected: false,
          focused: false,
          expanded: false,
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

  private async getFiles(path: string = this.config.workspaceDir): Promise<IFileTreeItem[]> {
    const files = await this.fileAPI.getFiles(path);
    this.files = files;
    this.updateFileStatus(files);
    if (files[0].children.length > 0) {
      this.fileServiceWatchers[path] = await this.fileServiceClient.watchFileChanges(new URI(path));
    }
    return files;
  }

  openFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_BROWSER_COMMANDS.openResource, uri);
  }

  openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_BROWSER_COMMANDS.openResource, uri);
  }
}
