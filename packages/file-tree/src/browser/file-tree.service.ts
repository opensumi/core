import { observable } from 'mobx';
import { Injectable, Inject, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { FileTreeAPI, IFileTreeItem, IFileTreeItemStatus } from '../common';
import { CommandService } from '../../../core-common/src/command';

import {servicePath as FileServicePath} from '@ali/ide-file-service/lib/common';
import { LabelProvider } from './label-provider';

@Injectable()
export default class FileTreeService extends Disposable {

  @observable.shallow
  files: IFileTreeItem[] = [];

  @observable
  status: IFileTreeItemStatus = {
    isSelected: '',
    isExpanded: observable.array([], { deep: false }),
  };

  @observable
  renderedStart: number;

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(LabelProvider)
  private labelProvider: LabelProvider;

  constructor(
    @Inject(FileServicePath) protected readonly fileSevice,
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
    // const {content} = await this.fileSevice.resolveContent('/Users/franklife/work/ide/ac/ide-framework/tsconfig.json');
    // console.log('content', content);

    // 只会执行注册在 Module 里声明的 Contribution
    this.commandService.executeCommand('file.tree.console');
  }

  updateFilesSelectedStatus(file: IFileTreeItem) {
    this.status.isSelected = file.id;
  }

  updateFilesExpandedStatus(file: IFileTreeItem) {
    if (file.filestat.isDirectory) {
      const index = this.status.isExpanded.indexOf(file.id);
      if (!file.expanded) {
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
  public async fileName(name) {
    console.log('fileName method', name);
  }

  private async getFiles() {
    this.files = await this.fileAPI.getFiles();
  }

}
