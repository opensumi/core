import { ITree, ITreeNode } from '@opensumi/ide-components';
import { BasicEvent, Event, IDisposable, URI } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

import { Directory, File } from './file-tree-node.define';

export const FILE_EXPLORER_WELCOME_ID = 'file-explorer';

export const IFileTreeAPI = Symbol('IFileTreeAPI');
export const IFileTreeService = Symbol('IFileTreeService');

export interface IFileTreeService extends ITree {
  refresh(): Promise<void>;
}

export interface IMoveFileMetadata {
  url: URI;
  isDirectory: boolean;
}

export interface IFileTreeAPI {
  onDidResolveChildren: Event<string>;

  copyFile(from: URI, to: URI): Promise<FileStat | string | void>;
  createFile(newUri: URI, content?: string): Promise<string | void>;
  createDirectory(newUri: URI): Promise<string | void>;
  delete(uri: URI): Promise<string | void>;
  mvFiles(oldUri: IMoveFileMetadata[], newUri: URI): Promise<string[] | void>;
  mv(oldUri: URI, newUri: URI, isDirectory?: boolean): Promise<string | void>;
  resolveChildren(
    tree: ITree,
    path: string | FileStat,
    parent?: Directory,
    compact?: boolean,
  ): Promise<{
    children: (File | Directory)[];
    filestat: FileStat;
  }>;
  resolveNodeByPath(tree: ITree, path: string, parent?: Directory): Promise<File | Directory | undefined>;
  toNode(tree: ITree, filestat: FileStat, parent?: Directory, name?: string): Directory | File;
  getReadableTooltip(path: URI): string;
  resolveFileStat(path: URI): Promise<FileStat | void>;
}

export class FileTreeExpandedStatusUpdateEvent extends BasicEvent<{ uri: URI; expanded: boolean }> {}

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

export const IFileDialogModel = Symbol('IFileDialogModel');

export interface IFileDialogModel extends IDisposable {
  whenReady: Promise<void>;
}

export const IFileDialogTreeService = Symbol('IFileDialogTreeService');

export interface IFileDialogTreeService extends ITree {
  getDirectoryList(): string[];
}

export const RESOURCE_VIEW_ID = 'file-explorer';
