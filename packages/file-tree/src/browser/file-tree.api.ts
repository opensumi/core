
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem, FileStat } from '../common/file-tree.defination';
import { URI } from '@ali/ide-core-common';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { AppConfig } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
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

  @Autowired()
  labelService: LabelService;

  constructor() {}

  async getFiles(path?: string, parent?: IFileTreeItem | null) {
    const files: any = await this.fileServiceClient.getFileStat(path || this.config.workspaceDir);
    const result = await this.fileStat2FileTreeItem(files, parent);
    return [ result ];
  }

  async createFile(file: IFileTreeItem) {
    return file;
  }

  async deleteFile(file: IFileTreeItem) {
    return;
  }

  async fileStat2FileTreeItem(filestat: FileStat, parent: IFileTreeItem | null = null): Promise<IFileTreeItem> {
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
    const uri = new URI(filestat.uri);
    const icon = await this.labelService.getIcon(uri);
    const name = this.labelService.getName(uri);
    if (filestat.isDirectory && filestat.children && filestat.children.length > 0) {
      Object.assign(result, {
        id: id++,
        uri,
        filestat,
        icon,
        name,
        children: sortby(await Promise.all(filestat.children.map((stat) => {
          return this.fileStat2FileTreeItem(stat, result);
        })), (file: IFileTreeItem) => {
          return !file.filestat.isDirectory;
        }),
        parent,
      });
    } else {
      Object.assign(result, {
        id: id++,
        uri,
        filestat,
        icon,
        name,
        children: [],
        parent,
      });
    }
    return result;
  }

}
