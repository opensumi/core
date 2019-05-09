import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core';
import { FileTreeAPI, CloudFile } from '../common';

@Injectable()
export default class FileTreeService extends Disposable {
  @observable.shallow
  files: CloudFile[] = [];

  @Autowired()
  private fileAPI!: FileTreeAPI;

  constructor() {
    super();

    this.getFiles();
  }

  createFile = async () => {
    const file = await this.fileAPI.createFile({
      name: 'name' + Date.now(),
      path: 'path' + Date.now(),
    });

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
