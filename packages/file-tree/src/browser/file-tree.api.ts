
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem } from '../common/file-tree.defination';
import { FileStat } from '@ali/ide-file-service';
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

  async getFiles(path: string | FileStat, parent?: IFileTreeItem | undefined) {
    let file: FileStat;
    if (typeof path === 'string') {
      file = await this.fileServiceClient.getFileStat(path);
    } else {
      file = await this.fileServiceClient.getFileStat(path.uri);
      file = {
        ...file,
        isSymbolicLink: path.isSymbolicLink,
      };
    }
    if (file) {
      const result = await this.fileStat2FileTreeItem(file, parent, file.isSymbolicLink || false);
      return [ result ];
    } else {
      return [];
    }
  }

  async getFileStat(path: string) {
    const stat: any = await this.fileServiceClient.getFileStat(path);
    return stat;
  }

  async createFile(uri: string) {
    await this.fileServiceClient.createFile(uri);
  }

  async createFolder(uri: string) {
    await this.fileServiceClient.createFolder(uri);
  }

  async exists(uri: string) {
   return await this.fileServiceClient.exists(uri);
  }

  async deleteFile(uri: URI) {
    await this.fileServiceClient.delete(uri.toString());
  }

  async moveFile(source: string, target: string) {
    await this.fileServiceClient.move(source, target);
  }

  async fileStat2FileTreeItem(filestat: FileStat, parent: IFileTreeItem | undefined, isSymbolicLink: boolean): Promise<IFileTreeItem> {
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
    const icon = this.labelService.getIcon(uri, {isDirectory: filestat.isDirectory, isSymbolicLink: filestat.isSymbolicLink});
    const name = this.labelService.getName(uri);
    if (filestat.isDirectory && filestat.children) {
      let children: IFileTreeItem[] = [];
      const childrenFileStat = filestat.children.filter((stat) => !!stat);
      for (const child of childrenFileStat) {
        const item = await this.fileStat2FileTreeItem(child, result, isSymbolicLink);
        children.push(item);
      }
      children = this.sortByNumberic(children);
      Object.assign(result, {
        id: id++,
        uri,
        filestat: {
          ...filestat,
          isSymbolicLink: filestat.isSymbolicLink || isSymbolicLink,
        },
        icon,
        name,
        children,
        parent,
      });
    } else {
      Object.assign(result, {
        id: id++,
        uri,
        filestat: {
          ...filestat,
          isSymbolicLink,
        },
        icon,
        name,
        parent,
      });
    }
    return result;
  }

  async generatorFileFromFilestat(filestat: FileStat, parent: IFileTreeItem): Promise<IFileTreeItem> {
    const uri = new URI(filestat.uri);
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: this.labelService.getName(uri),
      icon: await this.labelService.getIcon(uri, filestat),
      filestat,
      parent,
      depth: parent.depth + 1,
      order: 0,
    };
    if (filestat.isDirectory) {
      return {
        ...result,
        children: [],
        expanded: false,
      };
    }
    return result;
  }

  async generatorTempFile(path: string, parent: IFileTreeItem): Promise<IFileTreeItem> {
    const uri = new URI(path);
    const filestat: FileStat = {
      uri: path,
      isDirectory: false,
      isSymbolicLink: false,
      isTemporaryFile: true,
      lastModification: new Date().getTime(),
    };
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: this.labelService.getName(uri),
      icon: await this.labelService.getIcon(uri, filestat),
      filestat,
      parent,
      depth: parent.depth + 1,
      order: 1,
    };
    if (filestat.isDirectory) {
      return {
        ...result,
        children: [],
        expanded: false,
      };
    }
    return result;
  }

  async generatorTempFileFolder(path: string, parent: IFileTreeItem): Promise<IFileTreeItem> {
    const uri = new URI(path);
    const filestat: FileStat = {
      uri: path,
      isDirectory: true,
      isSymbolicLink: false,
      isTemporaryFile: true,
      lastModification: new Date().getTime(),
    };
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: this.labelService.getName(uri),
      icon: await this.labelService.getIcon(uri, filestat),
      filestat,
      parent,
      depth: parent.depth + 1,
      order: 1,
    };
    if (filestat.isDirectory) {
      return {
        ...result,
        children: [],
        expanded: false,
      };
    }
    return result;
  }

  sortByNumberic(files: IFileTreeItem[]): IFileTreeItem[] {
    return files.sort((a: IFileTreeItem, b: IFileTreeItem) => {
      if (a.filestat.isDirectory && b.filestat.isDirectory || !a.filestat.isDirectory && !b.filestat.isDirectory) {
        if (a.order > b.order) {
          return -1;
        }
        // numeric 参数确保数字为第一排序优先级
        return a.name.localeCompare(b.name, 'kn', { numeric: true });
      } else if (a.filestat.isDirectory && !b.filestat.isDirectory) {
        return -1;
      } else if (!a.filestat.isDirectory && b.filestat.isDirectory) {
        return 1;
      } else {
        return a.order > b.order ? -1 : 1;
      }
    });
  }
}
