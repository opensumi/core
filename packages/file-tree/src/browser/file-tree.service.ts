import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { FileTreeAPI, IFileTreeItem } from '../common';
import { CommandService } from '../../../core-common/src/command';
import { LabelProvider } from './label-provider';
import { URI } from '@ali/ide-core-common';
@Injectable()
export default class FileTreeService extends Disposable {
  @observable.shallow
  files: IFileTreeItem[] = [];

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(LabelProvider)
  private labelProvider: LabelProvider;

  constructor() {
    super();

    this.getFiles();
  }

  async createFile() {
    // 只会执行注册在 Module 里声明的 Contribution
    this.commandService.executeCommand('file.tree.console');
  }

  async getIcon(element: object) {
    const icon = await this.labelProvider.getIcon(element);
    return icon;
  }

  private async getFiles() {
    this.files = await this.fileAPI.getFiles();
  }
}
