
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem, FileStat } from '../common/file-tree.defination';
import { URI } from '@ali/ide-core-common';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { AppConfig } from '@ali/ide-core-browser';
import sortby = require('lodash.sortby');

let id = 0;

/**
 * TODO: 依赖 Connection 模块定义好之后实现这个模块
 */
@Injectable()
export class FileTreeAPIImpl implements FileTreeAPI {
  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired()
  private fileServiceClient: FileServiceClient;

  constructor() {}

  async getFiles(path?: string, parent?: IFileTreeItem | null) {
    const files: any = await this.fileServiceClient.getFileStat(path || this.config.workspaceDir);

    return [this.fileStat2FileTreeItem(files, parent)];
  }

  async createFile(file: IFileTreeItem) {
    return file;
  }

  async deleteFile(file: IFileTreeItem) {
    return;
  }

  fileStat2FileTreeItem(filestat: FileStat, parent: IFileTreeItem | null = null): IFileTreeItem {
    const result: IFileTreeItem = {
      id: 0,
      uri: new URI(''),
      name: '',
      filestat: {
        isDirectory: false,
        lastModification: 0,
        uri: '',
      },
      parent: null,
      children: [],
    };
    if (filestat.isDirectory && filestat.children && filestat.children.length > 0) {
      Object.assign(result, {
        id: id++,
        uri: new URI(filestat.uri),
        filestat,
        name: filestat.uri,
        children: sortby(filestat.children.map((stat) => {
          return this.fileStat2FileTreeItem(stat, result);
        }), (file: IFileTreeItem) => {
          return !file.filestat.isDirectory;
        }),
        parent,
      });
    } else {
      Object.assign(result, {
        id: id++,
        uri: new URI(filestat.uri),
        filestat,
        name: filestat.uri,
        children: [],
        parent,
      });
    }
    return result;
  }

}
