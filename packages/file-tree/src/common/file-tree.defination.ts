import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';
import { URI } from '@ali/ide-core-common';
export interface IFileTreeItem {
  id: number | string;
  uri: URI;
  filestat: FileStat;
  name: string;
  icon: string;
  parent: IFileTreeItem | null;
  expanded: boolean;
  selected: boolean;
  children: IFileTreeItem[] | any;
}

/**
 * A file resource with meta information.
 * !! this interface shoulde be in the filesystem
 */
export interface FileStat {

  /**
   * The URI of the file.
   */
  uri: URI;

  /**
   * The last modification of this file.
   */
  lastModification: number;

  /**
   * `true` if the resource is a directory. Otherwise, `false`.
   */
  isDirectory: boolean;

  /**
   * The children of the file stat.
   * If it is `undefined` and `isDirectory` is `true`, then this file stat is unresolved.
   */
  children?: FileStat[];

  /**
   * The size of the file if known.
   */
  size?: number;

}

@Injectable()
export abstract class FileTreeAPI {
  abstract getFiles(): Promise<IFileTreeItem[]>;
  abstract createFile(file: IFileTreeItem): Promise<IFileTreeItem>;
  abstract deleteFile(file: IFileTreeItem): Promise<void>;
}

export function createFileTreeAPIProvider<T extends FileTreeAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: FileTreeAPI,
    useClass: cls,
  };
}
