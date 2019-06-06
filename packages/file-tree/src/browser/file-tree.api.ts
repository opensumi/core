
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem, FileStat } from '../common/file-tree.defination';
import { URI } from '@ali/ide-core-common';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { LabelService } from '@ali/ide-core-browser/lib/services';

let id = 0;

@Injectable()
export class FileTreeAPIImpl implements FileTreeAPI {

  @Autowired()
  private fileServiceClient: FileServiceClient;

  @Autowired()
  labelService: LabelService;

  async getFiles(path: string, parent?: IFileTreeItem | undefined) {
    const files: any = await this.fileServiceClient.getFileStat(path);
    const result = await this.fileStat2FileTreeItem(files, parent);
    return [ result ];
  }

  async createFile(file: IFileTreeItem) {
    return file;
  }

  async deleteFile(file: IFileTreeItem) {
    // this.fileServiceClient.
  }

  async fileStat2FileTreeItem(filestat: FileStat, parent: IFileTreeItem | undefined ): Promise<IFileTreeItem> {
    const result: IFileTreeItem = {
      id: 0,
      uri: new URI(''),
      name: '',
      filestat: {
        isDirectory: false,
        lastModification: 0,
        uri: '',
      },
      parent,
      depth: 0,
      order: 0,
    };
    const uri = new URI(filestat.uri);
    const icon = await this.labelService.getIcon(uri);
    const name = this.labelService.getName(uri);
    if (filestat.isDirectory && filestat.children && !filestat.isSymbolicLink) {
      let children = await Promise.all(filestat.children.map((stat) => {
        return this.fileStat2FileTreeItem(stat, result);
      }));
      children = children.sort((a: IFileTreeItem, b: IFileTreeItem) => {
        if (a.filestat.isDirectory && b.filestat.isDirectory || !a.filestat.isDirectory && !b.filestat.isDirectory) {
          return a.name.localeCompare(b.name, 'kn', { numeric: true });
        } else if (a.filestat.isDirectory && !b.filestat.isDirectory) {
          return -1;
        } else if (!a.filestat.isDirectory && b.filestat.isDirectory) {
          return 1;
        }
        return 1;
      });
      Object.assign(result, {
        id: id++,
        uri,
        filestat,
        icon,
        name,
        children,
        parent,
      });
    } else {
      Object.assign(result, {
        id: id++,
        uri,
        filestat,
        icon,
        name,
        parent,
      });
    }
    return result;
  }

}
