import { Event, Uri } from '..';

import { FileChangeEvent } from './file-watch';

export * from './file-watch';

/**
 * @deprecated please import it from '@opensumi/ide-file-service/lib/common'
 * `import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';`
 */
export const IFileServiceClient = Symbol('IFileServiceClient');

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
   * 资源的创建时间
   */
  createTime?: number;

  /**
   * 资源是否为文件夹
   */
  isDirectory: boolean;

  /**
   * 资源是否为软连接
   */
  isSymbolicLink?: boolean;

  /**
   * 资源是否在软连接文件夹内
   */
  isInSymbolicDirectory?: boolean;

  /**
   * The children of the file stat.
   * If it is `undefined` and `isDirectory` is `true`, then this file stat is unresolved.
   */
  children?: FileStat[];

  /**
   * The size of the file if known.
   */
  size?: number;

  /**
   * 同 vscode FileType
   */
  type?: FileType;

  /**
   * 当前文件是否为只读
   */
  readonly?: boolean;
}

export namespace FileStat {
  export function is(candidate: object | undefined): candidate is FileStat {
    return (
      typeof candidate === 'object' &&
      'uri' in candidate &&
      'lastModification' in candidate &&
      'isDirectory' in candidate
    );
  }

  export function equals(one: object | undefined, other: object | undefined): boolean {
    if (!one || !other || !is(one) || !is(other)) {
      return false;
    }
    return (
      one.uri === other.uri && one.lastModification === other.lastModification && one.isDirectory === other.isDirectory
    );
  }
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

/**
 * Compatible with vscode.FileSystemProvider
 */
export interface FileSystemProvider {
  readonly capabilities: FileSystemProviderCapabilities;
  readonly onDidChangeCapabilities: Event<void>;

  readonly readonly?: boolean;
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
  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): number | Promise<number>;

  unwatch?(watcherId: number): void | Promise<void>;

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
  stat(uri: Uri): Promise<FileStat | void>;

  /**
   * Retrieve all entries of a [directory](#FileType.Directory).
   *
   * @param uri The uri of the folder.
   * @return An array of name/type-tuples or a thenable that resolves to such.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   */
  readDirectory(uri: Uri): [string, FileType][] | Promise<[string, FileType][]>;

  /**
   * Create a new directory (Note, that new files are created via `write`-calls).
   *
   * @param uri The uri of the new folder.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when the parent of `uri` doesn't exist, e.g. no mkdirp-logic required.
   * @throws [`FileExists`](#FileSystemError.FileExists) when `uri` already exists.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  createDirectory(uri: Uri): void | Promise<void | FileStat>;

  /**
   * Read the entire contents of a file.
   *
   * @param uri The uri of the file.
   * @return An array of bytes or a thenable that resolves to such.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   */
  readFile(uri: Uri, encoding?: string): Uint8Array | void | Promise<Uint8Array | void>;

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
  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean; encoding?: string },
  ): void | Thenable<void | FileStat>;

  /**
   * Delete a file.
   *
   * @param uri The resource that is to be deleted.
   * @param options Defines if deletion of folders is recursive.
   */
  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean }): void | Promise<void>;

  /**
   * Rename a file or folder.
   *
   * @param oldstring The existing file.
   * @param newstring The new location.
   * @param options Defines if existing files should be overwritten.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `oldstring` doesn't exist.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when parent of `newstring` doesn't exist, e.g. no mkdirp-logic required.
   * @throws [`FileExists`](#FileSystemError.FileExists) when `newstring` exists and when the `overwrite` option is not `true`.
   * @throws [`NoPermissions`](#FileSystemError.NoPermissions) when permissions aren't sufficient.
   */
  rename(oldstring: Uri, newstring: Uri, options: { overwrite: boolean }): void | Promise<void | FileStat>;
}

export const enum FileSystemProviderCapabilities {
  /**
   * Provider supports unbuffered read/write.
   */
  FileReadWrite = 1 << 1,

  /**
   * Provider supports open/read/write/close low level file operations.
   */
  FileOpenReadWriteClose = 1 << 2,

  /**
   * Provider supports stream based reading.
   */
  FileReadStream = 1 << 4,

  /**
   * Provider supports copy operation.
   */
  FileFolderCopy = 1 << 3,

  /**
   * Provider is path case sensitive.
   */
  PathCaseSensitive = 1 << 10,

  /**
   * All files of the provider are readonly.
   */
  Readonly = 1 << 11,

  /**
   * Provider supports to delete via trash.
   */
  Trash = 1 << 12,

  /**
   * Provider support to unlock files for writing.
   */
  FileWriteUnlock = 1 << 13,
}
