import Uri from 'vscode-uri';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { FileSystemWatcherServer , FileChangeEvent } from './file-service-watcher-protocol'
import { Event } from '@ali/ide-core-common';
import { EncodingInfo } from './encoding';
import { ApplicationError, Disposable } from '@ali/ide-core-common';

export const IFileService = Symbol('IFileService');

export interface IFileService extends FileSystemWatcherServer {

  /**
   * Returns the file stat for the given URI.
   *
   * If the uri points to a folder it will contain one level of unresolved children.
   *
   * `undefined` if a file for the given URI does not exist.
   */
  getFileStat(uri: string): Promise<FileStat | undefined>;

  /**
   * Finds out if a file identified by the resource exists.
   */
  exists(uri: string): Promise<boolean>;

  /**
   * Resolve the contents of a file identified by the resource.
   */
  resolveContent(uri: string, options?: { encoding?: string }): Promise<{ stat: FileStat, content: string }>;

  /**
   * Updates the content replacing its previous value.
   */
  setContent(file: FileStat, content: string, options?: { encoding?: string }): Promise<FileStat>;

  /**
   * Updates the content replacing its previous value.
   */
  updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: { encoding?: string }): Promise<FileStat>;

  /**
   * Moves the file to a new path identified by the resource.
   *
   * The optional parameter overwrite can be set to replace an existing file at the location.
   *
   * |           | missing | file | empty dir |    dir    |
   * |-----------|---------|------|-----------|-----------|
   * | missing   |    x    |   x  |     x     |     x     |
   * | file      |    ✓    |   x  |     x     |     x     |
   * | empty dir |    ✓    |   x  |     x     | overwrite |
   * | dir       |    ✓    |   x  | overwrite | overwrite |
   *
   */
  move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat>;

  /**
   * Copies the file to a path identified by the resource.
   *
   * The optional parameter overwrite can be set to replace an existing file at the location.
   */
  copy(sourceUri: string, targetUri: string, options?: { overwrite?: boolean, recursive?: boolean }): Promise<FileStat>;

  /**
   * Creates a new file with the given path. The returned promise
   * will have the stat model object as a result.
   *
   * The optional parameter content can be used as value to fill into the new file.
   */
  createFile(uri: string, options?: { content?: string, encoding?: string }): Promise<FileStat>;

  /**
   * Creates a new folder with the given path. The returned promise
   * will have the stat model object as a result.
   */
  createFolder(uri: string): Promise<FileStat>;

  /**
   * Creates a new empty file if the given path does not exist and otherwise
   * will set the mtime and atime of the file to the current date.
   */
  // touchFile(uri: string): Promise<FileStat>;

  /**
   * Deletes the provided file. The optional moveToTrash parameter allows to
   * move the file to trash.
   */
  delete(uri: string, options?: FileDeleteOptions): Promise<void>;

  /**
   * Returns the encoding of the given file resource.
   */
  getEncoding(uri: string): Promise<string>;

  /**
   * Returns the encoding info of the given encoding id
   */
  getEncodingInfo(encodingId: string | null): EncodingInfo | null;

  /**
   * Return list of available roots.
   */
  getRoots(): Promise<FileStat[]>;

  /**
   * Returns a promise that resolves to a file stat representing the current user's home directory.
   */
  getCurrentUserHome(): Promise<FileStat | undefined>;

  /**
   * Resolves to an array of URIs pointing to the available drives on the filesystem.
   */
  getDrives(): Promise<string[]>;

  /**
   * Tests a user's permissions for the file or directory specified by URI.
   * The mode argument is an optional integer that specifies the accessibility checks to be performed.
   * Check `FileAccess.Constants` for possible values of mode.
   * It is possible to create a mask consisting of the bitwise `OR` of two or more values (e.g. FileAccess.Constants.W_OK | FileAccess.Constants.R_OK).
   * If `mode` is not defined, `FileAccess.Constants.F_OK` will be used instead.
   */
  access(uri: string, mode?: number): Promise<boolean>;

  /**
   * Returns the path of the given file URI, specific to the backend's operating system.
   * If the URI is not a file URI, undefined is returned.
   *
   * USE WITH CAUTION: You should always prefer URIs to paths if possible, as they are
   * portable and platform independent. Pathes should only be used in cases you directly
   * interact with the OS, e.g. when running a command on the shell.
   */
  getFsPath(uri: string): Promise<string | undefined>;

  onFilesChanged: Event<FileChangeEvent>;

}

export namespace FileAccess {

  export namespace Constants {

    /**
     * Flag indicating that the file is visible to the calling process.
     * This is useful for determining if a file exists, but says nothing about rwx permissions. Default if no mode is specified.
     */
    export const F_OK: number = 0;

    /**
     * Flag indicating that the file can be read by the calling process.
     */
    export const R_OK: number = 4;

    /**
     * Flag indicating that the file can be written by the calling process.
     */
    export const W_OK: number = 2;

    /**
     * Flag indicating that the file can be executed by the calling process.
     * This has no effect on Windows (will behave like `FileAccess.F_OK`).
     */
    export const X_OK: number = 1;

  }

}

export interface FileStat {

  /**
   * 资源路径
   */
  uri: string;

  /**
   * 资源最后修改时间
   */
  lastModification: number;

  /**
   * 资源是否为文件夹
   */
  isDirectory: boolean;

  /**
	 * 资源是否为软连接
	 */
  isSymbolicLink?: boolean;

  /**
	 * 资源是否为临时文件
	 */
  isTemporaryFile?: boolean;

  /**
   * The children of the file stat.
   * If it is `undefined` and `isDirectory` is `true`, then this file stat is unresolved.
   */
  children?: FileStat[];

  /**
   * The size of the file if known.
   */
  size?: number;

  mime?: string;
  type?: string;
}

export namespace FileStat {
  export function is(candidate: Object | undefined): candidate is FileStat {
    return typeof candidate === 'object' && ('uri' in candidate) && ('lastModification' in candidate) && ('isDirectory' in candidate);
  }

  export function equals(one: object | undefined, other: object | undefined): boolean {
    if (!one || !other || !is(one) || !is(other)) {
      return false;
    }
    return one.uri === other.uri
      && one.lastModification === other.lastModification
      && one.isDirectory === other.isDirectory;
  }
}

export interface FileMoveOptions {
  overwrite?: boolean;
}

export interface FileDeleteOptions {
  moveToTrash?: boolean;
}

export namespace FileSystemError {
  export const FileNotFound = ApplicationError.declare(-33000, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''} '${uri}' has not been found.`,
    data: { uri }
  }));
  export const FileExists = ApplicationError.declare(-33001, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' already exists.`,
    data: { uri }
  }));
  export const FileIsDirectory = ApplicationError.declare(-33002, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' is a directory.`,
    data: { uri }
  }));
  export const FileNotDirectory = ApplicationError.declare(-33003, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' is not a directory.`,
    data: { uri }
  }));
  export const FileIsOutOfSync = ApplicationError.declare(-33004, (file: FileStat, stat: FileStat) => ({
    message: `'${file.uri}' is out of sync.`,
    data: { file, stat }
  }));
  export const FileDeleteFail = ApplicationError.declare(-33005, (uri: string) => ({
    message: `'${uri}' delete fail.`,
    data: { uri }
  }));
}

/**
 * Enumeration of file types. The types `File` and `Directory` can also be
 * a symbolic links, in that use `FileType.File | FileType.SymbolicLink` and
 * `FileType.Directory | FileType.SymbolicLink`.
 */
export enum FileType {
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


export interface FileSystemProvider {

  /**
   * An event to signal that a resource has been created, changed, or deleted. This
   * event should fire for resources that are being [watched](#FileSystemProvider.watch)
   * by clients of this provider.
   *
   * as Event<vscode.FileChangeEvent[]>
   */
  readonly onDidChangeFile: Event<FileChangeEvent>;

  /**
   * Subscribe to events in the file or folder denoted by `uri`.
   *
   * The editor will call this function for files and folders. In the latter case, the
   * options differ from defaults, e.g. what files/folders to exclude from watching
   * and if subfolders, sub-subfolder, etc. should be watched (`recursive`).
   *
   * @param uri The uri of the file to be watched.
   * @param options Configures the watch.
   * @returns A disposable that tells the provider to stop watching the `uri`.
   */
  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): Disposable;

  /**
   * Retrieve metadata about a file.
   *
   * Note that the metadata for symbolic links should be the metadata of the file they refer to.
   * Still, the [SymbolicLink](#FileType.SymbolicLink)-type must be used in addition to the actual type, e.g.
   * `FileType.SymbolicLink | FileType.Directory`.
   *
   * @param uri The uri of the file to retrieve metadata about.
   * @return The file metadata about the file.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   */
  stat(uri: Uri): FileStat | Thenable<FileStat>;

  /**
   * Retrieve all entries of a [directory](#FileType.Directory).
   *
   * @param uri The uri of the folder.
   * @return An array of name/type-tuples or a thenable that resolves to such.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   */
  readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]>;

  /**
   * Create a new directory (Note, that new files are created via `write`-calls).
   *
   * @param uri The uri of the new folder.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist, e.g. no mkdirp-logic required.
   * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  createDirectory(uri: Uri): void | Thenable<void>;

  /**
   * Read the entire contents of a file.
   *
   * @param uri The uri of the file.
   * @return An array of bytes or a thenable that resolves to such.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   */
  readFile(uri: Uri): Uint8Array | Thenable<Uint8Array>;

  /**
   * Write data to a file, replacing its entire contents.
   *
   * @param uri The uri of the file.
   * @param content The new content of the file.
   * @param options Defines if missing files should or must be created.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist and `create` is not set.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist and `create` is set, e.g. no mkdirp-logic required.
   * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists, `create` is set but `overwrite` is not set.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  writeFile(uri: Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void | Thenable<void>;

  /**
   * Delete a file.
   *
   * @param uri The resource that is to be deleted.
   * @param options Defines if deletion of folders is recursive.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  delete(uri: Uri, options: { recursive: boolean }): void | Thenable<void>;

  /**
   * Rename a file or folder.
   *
   * @param oldUri The existing file.
   * @param newUri The new location.
   * @param options Defines if existing files should be overwritten.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `oldUri` doesn't exist.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when parent of `newUri` doesn't exist, e.g. no mkdirp-logic required.
   * @throws [`FileExists`](#FileSystemError.FileExists) when `newUri` exists and when the `overwrite` option is not `true`.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): void | Thenable<void>;

  /**
   * Copy files or folders. Implementing this function is optional but it will speedup
   * the copy operation.
   *
   * @param source The existing file.
   * @param destination The destination location.
   * @param options Defines if existing files should be overwritten.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `source` doesn't exist.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when parent of `destination` doesn't exist, e.g. no mkdirp-logic required.
   * @throws [`FileExists`](#FileSystemError.FileExists) when `destination` exists and when the `overwrite` option is not `true`.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  copy?(source: Uri, destination: Uri, options: { overwrite: boolean }): void | Thenable<void>;
}

/**
 * Inner FileSystemProvider：内部实现的 Provider，可以直接在NODE主进程使用的，用FileSystemProvider标记
 * Insert FileSystemProvider: 一般指通过插件API注入进来的 Provider，主进程无法直接使用，用ID来标记，远程调用
 */
export type InnerOrInsertFileSystemProvider = FileSystemProvider | number;