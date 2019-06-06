import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';
import { TreeNode, CompositeTreeNode, ExpandableTreeNode} from '@ali/ide-core-browser/lib/components';

export interface IFileTreeItem extends TreeNode<IFileTreeItem> {
  filestat: FileStat;
  children?: IFileTreeItem[] | any;
}

export interface IFileTreeItemStatus {
  isSelected: string | number;
  isExpanded: (string| number)[];
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
  abstract createFile(file: IFileTreeItem): Promise<IFileTreeItem>;
  abstract deleteFile(file: IFileTreeItem): Promise<void>;
}

export function createFileTreeAPIProvider<T extends FileTreeAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: FileTreeAPI,
    useClass: cls,
  };
}
