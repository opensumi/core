
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem } from '../file-tree.defination';
import { FileStat } from '@ali/ide-file-service';
import { URI } from '@ali/ide-core-browser';

let id = 0;

@Injectable()
export class MockFileTreeAPIImpl implements FileTreeAPI {

  private userhomePath: URI = new URI('file://userhome');

  async getFiles(path: string | FileStat, parent?: IFileTreeItem | undefined) {
    let file: FileStat | undefined;
    if (typeof path === 'string') {
      file = {
        isDirectory: false,
        isSymbolicLink: false,
        uri: path,
        lastModification: (new Date()).getTime(),
      } as FileStat;
    } else {
      file = {
        isDirectory: false,
        isSymbolicLink: false,
        uri: path.uri,
        lastModification: (new Date()).getTime(),
      } as FileStat;
    }
    const result = await this.fileStat2FileTreeItem(file, parent, file.isSymbolicLink || false);
    return [ result ];
  }

  async getFileStat(path: string) {
    const stat: any = {
      isDirectory: false,
      isSymbolicLink: false,
      uri: path,
      lastModification: (new Date()).getTime(),
    };
    return stat;
  }

  async createFile(uri: URI) {
    console.log('createFile', uri);
  }

  async createFolder(uri: URI) {
    console.log('createFolder', uri);
  }

  async exists(uri: URI) {
    return !!uri;
  }

  async deleteFile(uri: URI) {
    console.log('deleteFile', uri);
  }

  async moveFile(from: URI, to: URI, isDirectory: boolean = false) {
    console.log('moveFile', from, to, isDirectory);
  }

  async copyFile(from: URI, to: URI) {
    console.log('copyFile', from, to);
  }

  fileStat2FileTreeItem(filestat: FileStat, parent: IFileTreeItem | undefined, isSymbolicLink: boolean): IFileTreeItem {
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
      priority: 1,
    };
    const uri = new URI(filestat.uri);
    const icon = '';
    const name = uri.displayName;
    if (filestat.isDirectory && filestat.children) {
      let children: IFileTreeItem[] = [];
      const childrenFileStat = filestat.children.filter((stat) => !!stat);
      for (const child of childrenFileStat) {
        const item = this.fileStat2FileTreeItem(child, result, isSymbolicLink);
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
        tooltip: this.getReadableTooltip(uri),
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
        tooltip: this.getReadableTooltip(uri),
        icon,
        name,
        parent,
      });
    }
    return result;
  }

  /**
   * 替换用户目录为 ~
   * 移除协议头文本 file://
   *
   * @param {URI} path
   * @returns
   * @memberof FileTreeAPIImpl
   */
  getReadableTooltip(path: URI) {
    const pathStr = path.toString();
    const userhomePathStr = this.userhomePath && this.userhomePath.toString();
    if (!this.userhomePath) {
      return path.withScheme('').toString();
    }
    if (this.userhomePath.isEqualOrParent(path)) {
      return pathStr.replace(userhomePathStr, '~');
    }
    return path.withScheme('').toString();
  }

  generatorFileFromFilestat(filestat: FileStat, parent: IFileTreeItem): IFileTreeItem {
    const uri = new URI(filestat.uri);
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: uri.displayName,
      icon: '',
      filestat,
      parent,
      depth: parent.depth ? parent.depth + 1 : 0,
      priority: 1,
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

  generatorTempFile(uri: URI, parent: IFileTreeItem, isDirectory: boolean = false): IFileTreeItem {
    const filestat: FileStat = {
      uri: uri.toString(),
      isDirectory,
      isSymbolicLink: false,
      isTemporaryFile: true,
      lastModification: new Date().getTime(),
    };
    const result: IFileTreeItem = {
      id: id++,
      uri,
      name: uri.displayName,
      icon: '',
      filestat,
      parent,
      depth: parent.depth ? parent.depth + 1 : 0,
      // 用于让新建的文件顺序排序优先于普通文件
      priority: 10,
    };
    if (isDirectory) {
      return {
        ...result,
        children: [],
        expanded: false,
      };
    }
    return result;
  }

  generatorTempFolder(uri: URI, parent: IFileTreeItem): IFileTreeItem {
    return this.generatorTempFile(uri, parent, true);
  }

  sortByNumberic(files: IFileTreeItem[]): IFileTreeItem[] {
    return files.sort((a: IFileTreeItem, b: IFileTreeItem) => {
      if ((a.filestat.isDirectory && b.filestat.isDirectory) || (!a.filestat.isDirectory && !b.filestat.isDirectory)) {
        if (a.priority > b.priority) {
          return -1;
        }
        if (a.priority < b.priority) {
          return 1;
        }
        // numeric 参数确保数字为第一排序优先级
        return a.name.localeCompare(b.name, 'kn', { numeric: true });
      } else if (a.filestat.isDirectory && !b.filestat.isDirectory) {
        return -1;
      } else if (!a.filestat.isDirectory && b.filestat.isDirectory) {
        return 1;
      } else {
        return a.priority > b.priority ? -1 : 1;
      }
    });
  }
}
