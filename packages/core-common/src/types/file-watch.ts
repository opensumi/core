import { URI } from '@opensumi/ide-utils';
export interface IFileSystemWatcherServer {
  /**
   * 根据给定参数启动文件监听
   * 返回对应watcher的id
   * @param {string} uri
   * @param {WatchOptions} [options]
   * @returns {Promise<number>}
   * @memberof IFileSystemWatcherServer
   */
  watchFileChanges(uri: string, options?: WatchOptions): Promise<number>;

  /**
   * 根据给定watcher的id注销对应的文件监听
   * @param {number} watcher
   * @returns {Promise<void>}
   * @memberof FileSystemWatcherServer
   */
  unwatchFileChanges(watcher: number): Promise<void>;
}

export interface FileSystemWatcherClient {
  /**
   * 文件监听下的文件修改时触发事件
   */
  onDidFilesChanged(event: DidFilesChangedParams): void;
}

export interface WatchOptions {
  excludes: string[];
}

export interface DidFilesChangedParams {
  changes: FileChange[];
}

export interface FileChange {
  uri: string;
  type: FileChangeType;
}

export namespace FileChange {
  export function isUpdated(change: FileChange, uri: URI): boolean {
    return change.type === FileChangeType.UPDATED && uri.toString() === change.uri;
  }
  export function isAdded(change: FileChange, uri: URI): boolean {
    return change.type === FileChangeType.ADDED && uri.toString() === change.uri;
  }
  export function isDeleted(change: FileChange, uri: URI): boolean {
    return change.type === FileChangeType.DELETED && URI.file(change.uri).isEqualOrParent(uri);
  }
  export function isAffected(change: FileChange, uri: URI): boolean {
    return isDeleted(change, uri) || uri.toString() === change.uri;
  }
  export function isChanged(change: FileChange, uri: URI): boolean {
    return !isDeleted(change, uri) && uri.toString() === change.uri;
  }
}

export type FileChangeEvent = FileChange[];
export namespace FileChangeEvent {
  export function isUpdated(event: FileChangeEvent, uri: URI): boolean {
    return event.some((change) => FileChange.isUpdated(change, uri));
  }
  export function isAdded(event: FileChangeEvent, uri: URI): boolean {
    return event.some((change) => FileChange.isAdded(change, uri));
  }
  export function isDeleted(event: FileChangeEvent, uri: URI): boolean {
    return event.some((change) => FileChange.isDeleted(change, uri));
  }
  export function isAffected(event: FileChangeEvent, uri: URI): boolean {
    return event.some((change) => FileChange.isAffected(change, uri));
  }
  export function isChanged(event: FileChangeEvent, uri: URI): boolean {
    return !isDeleted(event, uri) && event.some((change) => FileChange.isChanged(change, uri));
  }
}

export enum FileChangeType {
  UPDATED = 0,
  ADDED = 1,
  DELETED = 2,
}

export enum VSCFileChangeType {
  /**
   * The contents or metadata of a file have changed.
   */
  Changed = 1,

  /**
   * A file has been created.
   */
  Created = 2,

  /**
   * A file has been deleted.
   */
  Deleted = 3,
}
