import { Uri, Uri as URI, Event, IDisposable, CancellationToken, es5ClassCompat } from '@opensumi/ide-core-common';
import { FileSystemProviderCapabilities, FileChange } from '@opensumi/ide-file-service';
import { FileOperation } from '@opensumi/ide-workspace-edit';

import { Disposable } from './ext-types';
import { IWorkspaceEditDto } from './model.api';
import { UriComponents } from './models';

/**
 * Enumeration of file change types.
 */
export enum FileChangeType {
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

/**
 * The event filesystem providers must use to signal a file change.
 */
export interface FileChangeEvent {
  /**
   * The type of change.
   */
  type: FileChangeType;

  /**
   * The uri of the file that has changed.
   */
  uri: Uri;
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

export enum FilePermission {
  /**
   * File is readonly.
   */
  Readonly = 1,
}

/**
 * The `FileStat`-type represents metadata about a file
 */
export interface FileStat {
  /**
   * The type of the file, e.g. is a regular file, a directory, or symbolic link
   * to a file.
   */
  type: FileType;
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
  /**
   * The file permissions.
   */
  readonly permissions?: FilePermission;
}

export interface SourceTargetPair {
  source?: UriComponents;
  target: UriComponents;
}

export interface FileOverwriteOptions {
  overwrite: boolean;
}

export interface FileReadStreamOptions {
  /**
   * Is an integer specifying where to begin reading from in the file. If position is undefined,
   * data will be read from the current file position.
   */
  readonly position?: number;

  /**
   * Is an integer specifying how many bytes to read from the file. By default, all bytes
   * will be read.
   */
  readonly length?: number;

  /**
   * If provided, the size of the file will be checked against the limits.
   */
  limits?: {
    readonly size?: number;
    readonly memory?: number;
  };
}

export interface FileWriteOptions {
  overwrite: boolean;
  create: boolean;
}

export interface FileOpenOptions {
  create: boolean;
}

export interface FileDeleteOptions {
  recursive: boolean;
  useTrash: boolean;
}

export interface IWatchOptions {
  recursive: boolean;
  excludes: string[];
}

export enum FileSystemProviderErrorCode {
  FileExists = 'EntryExists',
  FileNotFound = 'EntryNotFound',
  FileNotADirectory = 'EntryNotADirectory',
  FileIsADirectory = 'EntryIsADirectory',
  NoPermissions = 'NoPermissions',
  Unavailable = 'Unavailable',
  Unknown = 'Unknown',
}

export function markAsFileSystemProviderError(error: Error, code: FileSystemProviderErrorCode): Error {
  error.name = code ? `${code} (FileSystemError)` : 'FileSystemError';
  return error;
}

/**
 * A type that filesystem providers should use to signal errors.
 *
 * This class has factory methods for common error-cases, like `EntryNotFound` when
 * a file or folder doesn't exist, use them like so: `throw vscode.FileSystemError.EntryNotFound(someUri);`
 */
@es5ClassCompat
export class FileSystemError extends Error {
  static FileExists(messageOrUri?: string | URI): FileSystemError {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.FileExists, FileSystemError.FileExists);
  }
  static FileNotFound(messageOrUri?: string | URI): FileSystemError {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.FileNotFound, FileSystemError.FileNotFound);
  }
  static FileNotADirectory(messageOrUri?: string | URI): FileSystemError {
    return new FileSystemError(
      messageOrUri,
      FileSystemProviderErrorCode.FileNotADirectory,
      FileSystemError.FileNotADirectory,
    );
  }
  static FileIsADirectory(messageOrUri?: string | URI): FileSystemError {
    return new FileSystemError(
      messageOrUri,
      FileSystemProviderErrorCode.FileIsADirectory,
      FileSystemError.FileIsADirectory,
    );
  }
  static NoPermissions(messageOrUri?: string | URI): FileSystemError {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.NoPermissions, FileSystemError.NoPermissions);
  }
  static Unavailable(messageOrUri?: string | URI): FileSystemError {
    return new FileSystemError(messageOrUri, FileSystemProviderErrorCode.Unavailable, FileSystemError.Unavailable);
  }

  readonly code: string;

  constructor(
    uriOrMessage?: string | URI,
    code: FileSystemProviderErrorCode = FileSystemProviderErrorCode.Unknown,
    terminator?: Function,
  ) {
    super(URI.isUri(uriOrMessage) ? uriOrMessage.toString(true) : uriOrMessage);
    this.code = terminator?.name ?? 'Unknown';
    // mark the error as file system provider error so that
    // we can extract the error code on the receiving side
    markAsFileSystemProviderError(this, code);

    // workaround when extending builtin objects and when compiling to ES5, see:
    // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    if (typeof (Object as any).setPrototypeOf === 'function') {
      (Object as any).setPrototypeOf(this, FileSystemError.prototype);
    }

    if (typeof Error.captureStackTrace === 'function' && typeof terminator === 'function') {
      // nice stack traces
      Error.captureStackTrace(this, terminator);
    }
  }
}

/**
 * The filesystem provider defines what the editor needs to read, write, discover,
 * and to manage files and folders. It allows extensions to serve files from remote places,
 * like ftp-servers, and to seamlessly integrate those into the editor.
 *
 * * *Note 1:* The filesystem provider API works with [uris](#Uri) and assumes hierarchical
 * paths, e.g. `foo:/my/path` is a child of `foo:/my/` and a parent of `foo:/my/path/deeper`.
 * * *Note 2:* There is an activation event `onFileSystem:<scheme>` that fires when a file
 * or folder is being accessed.
 * * *Note 3:* The word 'file' is often used to denote all [kinds](#FileType) of files, e.g.
 * folders, symbolic links, and regular files.
 */
export interface FileSystemProvider {
  /**
   * An event to signal that a resource has been created, changed, or deleted. This
   * event should fire for resources that are being [watched](#FileSystemProvider.watch)
   * by clients of this provider.
   */
  readonly onDidChangeFile: Event<FileChangeEvent[]>;

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
  writeFile(uri: Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void | Thenable<void>;

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

export interface IExtHostFileSystemInfoShape {
  $acceptProviderInfos(scheme: string, capabilities: number | null): void;
}

export interface IExtHostFileSystemShape {
  $stat(handle: number, resource: UriComponents): Promise<FileStat>;
  $readdir(handle: number, resource: UriComponents): Promise<[string, FileType][]>;
  $readFile(handle: number, resource: UriComponents): Promise<Uint8Array>;
  $writeFile(handle: number, resource: UriComponents, content: Uint8Array, opts: FileWriteOptions): Promise<void>;
  $rename(handle: number, resource: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void>;
  $copy(handle: number, resource: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void>;
  $mkdir(handle: number, resource: UriComponents): Promise<void>;
  $delete(handle: number, resource: UriComponents, opts: FileDeleteOptions): Promise<void>;
  $watch(handle: number, session: number, resource: UriComponents, opts: IWatchOptions): void;
  $unwatch(handle: number, session: number): void;
}

export interface IMainThreadFileSystemShape extends IDisposable {
  $registerFileSystemProvider(handle: number, scheme: string, capabilities: FileSystemProviderCapabilities): void;
  $unregisterProvider(handle: number): void;
  $onFileSystemChange(handle: number, resource: FileChange[]): void;

  $stat(uri: UriComponents): Promise<FileStat>;
  $readdir(resource: UriComponents): Promise<[string, FileType][]>;
  $readFile(resource: UriComponents): Promise<Uint8Array>;
  $writeFile(resource: UriComponents, content: Uint8Array): Promise<void>;
  $rename(resource: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void>;
  $copy(resource: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void>;
  $mkdir(resource: UriComponents): Promise<void>;
  $delete(resource: UriComponents, opts: FileDeleteOptions): Promise<void>;
}

export interface FileSystemEvents {
  created: UriComponents[];
  changed: UriComponents[];
  deleted: UriComponents[];
}

export interface IExtHostFileSystemEvent {
  $onFileEvent(events: FileSystemEvents): void;
  $onWillRunFileOperation(
    operation: FileOperation,
    files: SourceTargetPair[],
    timeout: number,
    token: CancellationToken,
  ): Promise<IWillRunFileOperationParticipation | undefined>;
  $onDidRunFileOperation(operation: FileOperation, files: SourceTargetPair[]): void;
}

export interface IWillRunFileOperationParticipation {
  edit: IWorkspaceEditDto;
  extensionNames: string[];
}
