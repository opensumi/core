import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';
import { URI } from '@ali/ide-core-common';

export type IFileTreeItemId = number | string;
export interface IFileTreeItem {
  id: IFileTreeItemId;
  uri: URI;
  filestat: FileStat;
  name: string;
  icon: string;
  parent: IFileTreeItem | null;
  children: IFileTreeItem[] | any;
  selected?: boolean;
  expanded?: boolean;
}

export interface IFileTreeItemStatus {
  isSelected: IFileTreeItemId;
  isExpanded: IFileTreeItemId[];
}
/**
 * A file resource with meta information.
 * !! this interface shoulde be in the filesystem
 */
export interface FileStat {

  /**
   * 文件的URI.
   */
  uri: URI;

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
  isLinkFile?: boolean;

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
