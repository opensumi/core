import * as vscode from 'vscode';
import { Event, IDisposable } from '@ali/ide-core-common';
import { FileChange, FileChangeEvent } from './file-service-watcher-protocol';
import { FileSystemProvider } from './files';

export interface IMainThreadFileSystem {
  $subscribeWatcher(options: ExtFileSystemWatcherOptions): number;
  $unsubscribeWatcher(id: number);
  $fireProvidersFilesChange(e: FileChangeEvent);

  haveProvider(scheme: string): Promise<boolean>;
  unWatchFileWithProvider(id: number);
  watchFileWithProvider(uri: string, options: { recursive: boolean; excludes: string[] }): Promise<number>;
  runProviderMethod(
    scheme: string,
    funName: string,
    args: any[],
  ): Promise<any>;
}

export interface IExtHostFileSystem {
  onDidChange: Event<ExtFileChangeEventInfo>;
  $onFileEvent(options: ExtFileChangeEventInfo);

  subscribeWatcher(options: ExtFileSystemWatcherOptions): Promise<number>;
  unsubscribeWatcher(id: number): Promise<void>;

  registerFileSystemProvider(
    scheme: string,
    provider: vscode.FileSystemProvider,
    options: { isCaseSensitive?: boolean, isReadonly?: boolean },
  ): IDisposable;

  $haveProvider(scheme: string): Promise<boolean>;
  $watchFileWithProvider(uri: string, options: { recursive: boolean; excludes: string[] }): Promise<number>;
  $unWatchFileWithProvider(id: number);
  $runProviderMethod(
    scheme: string,
    funName: string,
    args: any[],
  ): Promise<any>;
}

export interface ExtFileChangeEventInfo {
  id: number;
  event: FileChange;
}

export interface ExtFileSystemWatcherOptions {
  globPattern: vscode.GlobPattern;
  ignoreCreateEvents: boolean;
  ignoreChangeEvents: boolean;
  ignoreDeleteEvents: boolean;
}

export type ParsedPattern = (path: string, basename?: string) => boolean;

export interface ExtFileWatcherSubscriber {
  id: number;
  mather: ParsedPattern;
  ignoreCreateEvents: boolean;
  ignoreChangeEvents: boolean;
  ignoreDeleteEvents: boolean;
}

export interface IFileServiceExtClient {
  setExtFileSystemClient(client: IMainThreadFileSystem);

  runExtFileSystemClientMethod(funName: string, args: any[]): Promise<any>;
  runExtFileSystemProviderMethod(
    scheme: string,
    funName: string,
    args: any[],
  ): Promise<void>;
}

export enum VSCFileType {
  /**
   * The file type is unknown.
   */
  Unknown = 0,
  /**
   * A regular file.
   */
  File = 1,
  /**
   * A directory.
   */
  Directory = 2,
  /**
   * A symbolic link to a file.
   */
  SymbolicLink = 64,
}

/**
 * The `FileStat`-type represents metadata about a file
 */
export interface VSCFileStat {
  /**
   * The type of the file, e.g. is a regular file, a directory, or symbolic link
   * to a file.
   */
  type: VSCFileType;
  /**
   * The creation timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
   */
  ctime: number;
  /**
   * The modification timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
   */
  mtime: number;
  /**
   * The size in bytes.
   */
  size: number;
}
