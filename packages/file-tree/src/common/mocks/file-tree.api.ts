
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem } from '../file-tree.defination';
import { FileStat } from '@ali/ide-file-service';
import { URI } from '@ali/ide-core-browser';
import { Directory, File, AbstractFileTreeItem } from '../../browser/file-tree-item';

@Injectable()
export class MockFileTreeAPIImpl implements FileTreeAPI {

  private userhomePath: URI = new URI('file://userhome');

  async getFiles(path: string | FileStat, parent?: Directory | undefined) {
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
    return [result];
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

  fileStat2FileTreeItem(filestat: FileStat, parent: Directory | undefined, isInSymbolicDirectory: boolean): Directory | File {
    const uri = new URI(filestat.uri);
    const icon = '';
    const name = '';
    if (filestat.isDirectory && filestat.children) {
      return new Directory(
        uri,
        name,
        {
          ...filestat,
          isSymbolicLink: filestat.isSymbolicLink,
          isInSymbolicDirectory,
        },
        this.getReadableTooltip(uri),
        icon,
        parent,
        1,
        this,
      );
    } else {
      return new File(
        uri,
        name,
        {
          ...filestat,
          isSymbolicLink: filestat.isSymbolicLink,
          isInSymbolicDirectory,
        },
        this.getReadableTooltip(uri),
        icon,
        parent,
        1,
        this,
      );
    }
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

  generatorFileFromFilestat(filestat: FileStat, parent: Directory): AbstractFileTreeItem {
    const uri = new URI(filestat.uri);
    if (filestat.isDirectory) {
      return new Directory(
        uri,
        '',
        filestat,
        this.getReadableTooltip(uri),
        '',
        parent,
        1,
        this,
      );
    }
    return new File(
      uri,
      '',
      filestat,
      this.getReadableTooltip(uri),
      '',
      parent,
      1,
      this,
    );
  }

  generatorTempFile(uri: URI, parent: Directory, isDirectory: boolean = false): AbstractFileTreeItem {
    const filestat: FileStat = {
      uri: uri.toString(),
      isDirectory,
      isSymbolicLink: false,
      lastModification: new Date().getTime(),
    };
    if (isDirectory) {
      return new Directory(
        uri,
        '',
        filestat,
        '',
        '',
        parent,
        10,
        this,
        true,
      );
    }
    return new File(
      uri,
      '',
      filestat,
      '',
      '',
      parent,
      10,
      this,
    );
  }

  generatorTempFolder(uri: URI, parent: Directory): AbstractFileTreeItem {
    return this.generatorTempFile(uri, parent, true);
  }

  sortByNumberic(files: AbstractFileTreeItem[]): AbstractFileTreeItem[] {
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
