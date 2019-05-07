import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core';
import { FileTreeAPI, CloudFile } from '../common';

@Injectable()
export default class FileTreeService extends Disposable {
  @observable.ref
  files: CloudFile[] | null = null;

  @Autowired()
  private fileAPI!: FileTreeAPI;

  constructor() {
    super();

    this.getFiles();
  }

  private async getFiles() {
    this.files = await this.fileAPI.getFiles();
  }
}
