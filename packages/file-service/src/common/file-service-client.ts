import { URI, Event, IFileServiceClient as IFileServiceClientToken, IDisposable } from '@ali/ide-core-common';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { FileStat,
  FileMoveOptions,
  FileDeleteOptions,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
} from './files';
import { IFileServiceWatcher } from './watcher';
import { DidFilesChangedParams, FileChangeEvent } from './file-service-watcher-protocol';

export const IFileServiceClient = IFileServiceClientToken;

export interface IFileServiceClient {

  handlesScheme(scheme: string): boolean;

  resolveContent(uri: string, options?: FileSetContentOptions): Promise<{ stat: FileStat, content: string }>;

  getFileStat(uri: string): Promise<FileStat | undefined>;

  getFileType(uri: string): Promise<string|undefined>;

  setContent(file: FileStat, content: string, options?: FileSetContentOptions): Promise<FileStat>;

  updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: FileSetContentOptions): Promise<FileStat>;

  createFile(uri: string, options?: FileCreateOptions): Promise<FileStat>;

  createFolder(uri: string): Promise<FileStat>;

  access(uri: string, mode?: number): Promise<boolean>;

  move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat>;

  copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat>;

  delete(uri: string, options?: FileDeleteOptions);

  getCurrentUserHome(): Promise<FileStat | undefined>;

  onDidFilesChanged(event: DidFilesChangedParams): void;

  watchFileChanges(uri: URI): Promise<IFileServiceWatcher>;

  unwatchFileChanges(watchId: number): Promise<void>;

  exists(uri: string): Promise<boolean>;

  fireFilesChange(e: FileChangeEvent): Promise<void>;

  onFilesChanged: Event<FileChangeEvent>;

  setWatchFileExcludes(excludes: string[]): Promise<void>;

  getWatchFileExcludes(): Promise<string[]>;

  setFilesExcludes(excludes: string[]): Promise<void>;

  getFsPath(uri: string): Promise<string | undefined>;
}

export interface IBrowserFileSystemRegistry {

  registerFileSystemProvider(provider: IFileSystemProvider): IDisposable;

}

export const IBrowserFileSystemRegistry = Symbol('IBrowserFileSystemRegistry');

// TODO 重构前真正的provider仍然注册在node层，这里只保留scheme让它能够欧正常判断是否处理scheme
export interface IFileSystemProvider {

  scheme: string;

}
