import { URI, BasicEvent } from '@ali/ide-core-common';
import { ITree, ITreeNode } from '@ali/ide-components';
import { FileStat } from '@ali/ide-file-service';
import { Directory, File } from '../browser/file-tree-nodes';

export const IFileTreeAPI = Symbol('IFileTreeAPI');

export interface IFileTreeAPI {
  copyFile(from: URI, to: URI): Promise<FileStat | string | void>;
  createFile(newUri: URI): Promise<string | void>;
  createDirectory(newUri: URI): Promise<string | void>;
  delete(uri: URI): Promise<string | void>;
  mvFiles(oldUri: URI[], newUri: URI, isDirectory?: boolean): Promise<string[] | void>;
  mv(oldUri: URI , newUri: URI, isDirectory?: boolean): Promise<string | void>;
  resolveChildren(tree: ITree, path: string | FileStat, parent?: Directory): Promise<(File | Directory)[]>;
  resolveNodeByPath(tree: ITree, path: string, parent?: Directory): Promise<File | Directory | undefined>;
  toNode(tree: ITree, filestat: FileStat, parent?: Directory): Directory | File;
  getReadableTooltip(path: URI): string;
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

export enum PasteTypes {
  NONE,
  COPY,
  CUT,
}
