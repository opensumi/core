import { observable } from 'mobx';
import { Injectable, Inject, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { FileTreeAPI, CloudFile } from '../common';
import { CommandService } from '../../../core-common/src/command';
import {servicePath as FileServicePath} from '@ali/ide-file-service';

@Injectable()
export default class FileTreeService extends Disposable {

  @observable.shallow
  files: CloudFile[] = [];

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  constructor(@Inject(FileServicePath) protected readonly fileSevice) {
    super();

    this.getFiles();
  }

  createFile = async () => {
    const {content} = await this.fileSevice.resolveContent('/Users/franklife/work/ide/ac/ide-framework/tsconfig.json');
    const file = await this.fileAPI.createFile({
      name: 'name' + Date.now() + '\n' + content,
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
  public async fileName(name) {
    console.log('fileName method', name);
    alert(name);
  }

  private async getFiles() {
    this.files = await this.fileAPI.getFiles();
  }
}
