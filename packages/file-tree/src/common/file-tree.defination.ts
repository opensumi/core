import { Injectable, Provider } from '@ali/common-di';
import {
  URI,
  ConstructorOf,
} from '@ali/ide-core-browser';
import { FileStat } from '@ali/ide-file-service';
import { SelectableTreeNode, TreeNode } from '@ali/ide-core-common';
import { File, Directory } from '../browser/file-tree-item';

export interface IFileTreeItem extends TreeNode<IFileTreeItem> {
  uri: URI;
  filestat: FileStat;
  children?: IFileTreeItem[] | any;
  // 排序优先级，数字越大优先级越高
  // 用于让新建文件的排序位置更靠前
  priority: number;
  [key: string]: any;
}

export interface FileStatNode extends SelectableTreeNode {
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

  export function getUri(node: TreeNode | undefined): string | undefined {
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

export interface IParseStore {
  files: URI[];
  type: PasteTypes;
}

export const IFileTreeAPI = Symbol('IFileTreeAPI');

export interface IFileTreeAPI {
  getFiles(path: string | FileStat, parent?: Directory | File | null): Promise<(Directory | File)[]>;
  getFileStat(path: string): Promise<any>;
  createFile(uri: URI): Promise<void>;
  createFolder(uri: URI): Promise<void>;
  deleteFile(uri: URI): Promise<void>;
  moveFile(from: URI, to: URI, isDirectory?: boolean): Promise<void>;
  copyFile(from: URI, to: URI): Promise<void>;
  getReadableTooltip(path: URI): string;
  generatorFileFromFilestat(filestat: FileStat, parent: Directory): Directory | File;
  generatorTempFile(uri: URI, parent: Directory): Directory | File;
  generatorTempFolder(uri: URI, parent: Directory): Directory | File;
  sortByNumberic(files: Directory | File[]): (Directory | File)[];
  exists(uri: URI): Promise<boolean>;
  fileStat2FileTreeItem(filestat: FileStat, parent: Directory | undefined, isSymbolicLink?: boolean): Directory | File;
}
