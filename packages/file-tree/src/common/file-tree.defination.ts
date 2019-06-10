import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';
import { TreeNode } from '@ali/ide-core-browser/lib/components';
import { URI } from '@ali/ide-core-common';

export interface IFileTreeItem extends TreeNode<IFileTreeItem> {
  filestat: FileStat;
  children?: IFileTreeItem[] | any;
  [key: string]: any;
}

export interface IFileTreeItemStatus {
  [key: string]: {
    selected?: boolean;
    expanded?: boolean;
    focused?: boolean;
    file?: IFileTreeItem;
  };
}
/**
 * A file resource with meta information.
 * !! this interface shoulde be in the filesystem
 */
export interface FileStat {

  /**
   * 文件的URI.
   */
  uri: string;

  /**
   * 文件最后修改时间.
   */
  lastModification: number;

  /**
   * 是否为文件夹.
   */
  isDirectory: boolean;

  /**
   * 是否为软连接
   */
  isSymbolicLink?: boolean;

  /**
   * 子项的状态
   */
  children?: FileStat[];

  /**
   * 文件大小.
   */
  size?: number;

}

@Injectable()
export abstract class FileTreeAPI {
  abstract getFiles(path?: string, parent?: IFileTreeItem | null): Promise<IFileTreeItem[]>;
  abstract createFile(uri: string): Promise<void>;
  abstract createFileFolder(uri: string): Promise<void>;
  abstract deleteFile(uri: URI): Promise<void>;
  abstract generatorFile(path: string, parent: IFileTreeItem): Promise<IFileTreeItem>;
  abstract sortByNumberic(files: IFileTreeItem[]): IFileTreeItem[];
}

export function createFileTreeAPIProvider<T extends FileTreeAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: FileTreeAPI,
    useClass: cls,
  };
}
