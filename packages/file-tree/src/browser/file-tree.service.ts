import { observable } from 'mobx';
import { Injectable, Inject, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { FileTreeAPI, IFileTreeItem, IFileTreeItemStatus } from '../common';
import { CommandService } from '../../../core-common/src/command';
import { ResizeEvent } from '@ali/ide-main-layout/lib/browser/ide-widget.view';
import { SlotLocation } from '@ali/ide-main-layout';
import { EDITOR_BROSWER_COMMANDS, IResource } from '@ali/ide-editor';

@Injectable()
export default class FileTreeService extends WithEventBus {

  @observable.shallow
  files: IFileTreeItem[] = [];

  @observable
  status: IFileTreeItemStatus = {
    isSelected: '',
    isExpanded: observable.array([], { deep: false }),
  };

  @observable
  renderedStart: number;

  @observable
  layout: any = {
    width: 300,
    height: 100,
  };

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  constructor(
  ) {
    super();
    this.init();
  }

  async init() {
    await this.getFiles();
    if (this.files.length > 0) {
      this.status.isSelected = this.files[0].id;
      this.status.isExpanded = [this.files[0].id];
    }
    this.renderedStart = 0;
  }

  createFile = async () => {
    // 调用示例
    // const {content} = await this..resolveContent('/Users/franklife/work/ide/ac/ide-framework/tsconfig.json');
    // console.log('content', content);

    // 只会执行注册在 Module 里声明的 Contribution
    this.commandService.executeCommand('file.tree.console');
  }

  updateFilesSelectedStatus(file: IFileTreeItem) {
    this.status.isSelected = file.id;
  }

  async updateFilesExpandedStatus(file: IFileTreeItem) {
    if (file.filestat.isDirectory) {
      const index = this.status.isExpanded.indexOf(file.id);
      if (!file.expanded) {
        // 如果当前目录下的子文件为空，尝试调用fileservice加载文件
        if (file.children.length === 0) {
          for (let i = 0, len = file.parent!.children.length; i < len; i++) {
            if ( file.parent!.children[i].id === file.id) {
              const files: IFileTreeItem[] = await this.fileAPI.getFiles(file.name, file.parent!.children[i]);
              file.parent!.children[i].children = files[0].children;
              break;
            }
          }
        }
        if (index < 0) {
          this.status.isExpanded.push(file.id);
        }
      } else {
        if (index >= 0) {
          this.status.isExpanded.splice(index, 1);
        }
      }
    }
  }

  updateRenderedStart(value: number) {
    this.renderedStart = value;
  }

  public async fileName(name: string) {
    console.log('fileName method', name);
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === SlotLocation.leftPanel) {
      this.layout = e.payload;
    }
  }

  private async getFiles() {
    const files = await this.fileAPI.getFiles();
    this.files = files;
  }

  async openFile(resource: IResource) {
    this.commandService.executeCommand(EDITOR_BROSWER_COMMANDS.openResource, resource);
  }
}
