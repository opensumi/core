
import { Injectable, Autowired } from '@ali/common-di';
import { FileTreeAPI, IFileTreeItem } from '../file-tree.defination';
import { FileStat } from '@ali/ide-file-service';
import { URI } from '@ali/ide-core-browser';
import { Directory, File, AbstractFileTreeItem } from '../../browser/file-tree-item';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';

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
  }

  async createFolder(uri: URI) {
  }

  async exists(uri: URI) {
    return !!uri;
  }

  async deleteFile(uri: URI) {
  }

  async moveFile(from: URI, to: URI, isDirectory: boolean = false) {
  }

  async copyFile(from: URI, to: URI) {
  }

  fileStat2FileTreeItem(filestat: FileStat, parent: Directory | undefined, isInSymbolicDirectory: boolean): Directory | File {
    const uri = new URI(filestat.uri);
    const icon = '';
    const name = '';
    if (filestat.isDirectory && filestat.children) {
      return new Directory(
        this,
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
      );
    } else {
      return new File(
        this,
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
        this,
        uri,
        uri.displayName,
        filestat,
        this.getReadableTooltip(uri),
        '',
        parent,
        1,
      );
    }
    return new File(
      this,
      uri,
      uri.displayName,
      filestat,
      this.getReadableTooltip(uri),
      '',
      parent,
      1,
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
        this,
        uri,
        TEMP_FILE_NAME,
        filestat,
        '',
        '',
        parent,
        10,
        true,
      );
    }
    return new File(
      this,
      uri,
      TEMP_FILE_NAME,
      filestat,
      '',
      '',
      parent,
      10,
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
