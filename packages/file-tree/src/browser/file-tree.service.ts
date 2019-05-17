import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { FileTreeAPI, CloudFile } from '../common';
import { CommandService } from '../../../core-common/src/command';

@Injectable()
export default class FileTreeService extends Disposable {
  @observable.shallow
  files: CloudFile[] = [];

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  constructor() {
    super();

    this.getFiles();
  }

  createFile = async () => {
    const file = await this.fileAPI.createFile({
      name: 'name' + Date.now(),
      path: 'path' + Date.now(),
    });

    // 只会执行注册在 Module 里声明的 Contribution
    this.commandService.executeCommand('file.tree.console');

    if (this.files) {
      this.files.push(file);
    } else {
      this.files = [file];
    }
  }

  private async getFiles() {
    this.files = await this.fileAPI.getFiles();
  }
}
