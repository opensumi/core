import { URI, BasicEvent } from '@ali/ide-core-common';
import { ITree, ICompositeTreeNode, ITreeNodeOrCompositeTreeNode, ITreeNode } from '@ali/ide-components';
import { FileStat } from '@ali/ide-file-service';

export const IFileTreeAPI = Symbol('IFileTreeAPI');

export interface IFileTreeAPI {
  resolveChildren(tree: ITree, path: string | FileStat, parent?: ICompositeTreeNode): Promise<ITreeNodeOrCompositeTreeNode[]>;
}

export class FileTreeExpandedStatusUpdateEvent extends BasicEvent<{uri: URI, expanded: boolean}> {}

export interface FileStatNode extends ITreeNode {
  uri: URI;
  filestat: FileStat;
}

export namespace FileStatNode {
  export function is(node: object | undefined): node is FileStatNode {
    return !!node && 'filestat' in node;
  }
  export function isContentFile(node: any | undefined): node is FileStatNode {
    return !!node && 'filestat' in node && !node.fileStat.isDirectory;
  }

  export function getUri(node: ITreeNode | undefined): string | undefined {
    if (is(node)) {
      return node.filestat.uri;
    }
    return undefined;
  }
}
