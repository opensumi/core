/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/filesystem/src/common/filesystem.ts

import { Range } from 'vscode-languageserver-types';

import { FileSystemWatcherServer, DidFilesChangedParams, WatchOptions } from '@opensumi/ide-core-common';
import {
  ApplicationError,
  Event,
  IDisposable,
  Uri,
  URI,
  isUndefinedOrNull,
  hasProperty,
  isFunction,
  FileChangeEvent,
} from '@opensumi/ide-core-common';
import { FileSystemProvider, FileStat } from '@opensumi/ide-core-common/lib/types/file';
export {
  FileSystemProviderCapabilities,
  FileSystemProvider,
  FileType,
  FileStat,
} from '@opensumi/ide-core-common/lib/types/file';
export * from '@opensumi/ide-core-common/lib/types/file-watch';

export const IDiskFileProvider = Symbol('IDiskFileProvider');

export const IShadowFileProvider = Symbol('IShadowFileProvider');

export const IFileService = Symbol('IFileService');

export interface TextDocumentContentChangeEvent {
  /**
   * The range of the document that changed.
   */
  range?: Range;
  /**
   * The length of the range that got replaced.
   */
  rangeLength?: number;
  /**
   * The new text of the document.
   */
  text: string;
}

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
   * Resolve the contents of a file identified by the resource.
   */
  resolveContent(uri: string, options?: FileSetContentOptions): Promise<{ stat: FileStat; content: string }>;

  /**
   * Updates the content replacing its previous value.
   */
  setContent(file: FileStat, content: string, options?: FileSetContentOptions): Promise<FileStat>;

  /**
   * Updates the content replacing its previous value.
   */
  updateContent(
    file: FileStat,
    contentChanges: TextDocumentContentChangeEvent[],
    options?: FileSetContentOptions,
  ): Promise<FileStat>;

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
  copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat>;

  /**
   * Creates a new file with the given path. The returned promise
   * will have the stat model object as a result.
   *
   * The optional parameter content can be used as value to fill into the new file.
   */
  createFile(uri: string, options?: { content?: string; encoding?: string }): Promise<FileStat>;

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
  // getEncodingInfo(encodingId: string | null): EncodingInfo | null;

  /**
   * Returns a promise that resolves to a file stat representing the current user's home directory.
   */
  getCurrentUserHome(): Promise<FileStat | undefined>;

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

  getFileType(uri: string): Promise<string | undefined>;

  onFilesChanged: Event<DidFilesChangedParams>;

  fireFilesChange(e: FileChangeEvent);

  watchFileChanges(uri: string, options?: WatchOptions): Promise<number>;

  setWatchFileExcludes(excludes: string[]);

  getWatchFileExcludes(): string[];

  setFilesExcludes(excludes: string[], roots?: string[]);

  getFilesExcludes(): string[];

  setWorkspaceRoots(roots: string[]);

  registerProvider(scheme: string, provider: FileSystemProvider): IDisposable;

  getUri(uri: string | Uri): URI;

  dispose(): void;
}

export namespace FileAccess {
  export namespace Constants {
    /**
     * Flag indicating that the file is visible to the calling process.
     * This is useful for determining if a file exists, but says nothing about rwx permissions. Default if no mode is specified.
     */
    export const F_OK = 0;

    /**
     * Flag indicating that the file can be read by the calling process.
     */
    export const R_OK = 4;

    /**
     * Flag indicating that the file can be written by the calling process.
     */
    export const W_OK = 2;

    /**
     * Flag indicating that the file can be executed by the calling process.
     * This has no effect on Windows (will behave like `FileAccess.F_OK`).
     */
    export const X_OK = 1;
  }
}

export interface FileMoveOptions {
  overwrite?: boolean;
}

export interface FileDeleteOptions {
  moveToTrash?: boolean;
}

export interface FileSetContentOptions {
  encoding?: string;
}

export interface FileCreateOptions {
  content?: string;
  encoding?: string;
  overwrite?: boolean;
}

export interface FileCopyOptions {
  overwrite?: boolean;
}

export namespace FileSystemError {
  export const FileNotFound = ApplicationError.declare(-33000, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''} '${uri}' has not been found.`,
    data: { uri },
  }));
  export const FileExists = ApplicationError.declare(-33001, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' already exists.`,
    data: { uri },
  }));
  export const FileIsDirectory = ApplicationError.declare(-33002, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' is a directory.`,
    data: { uri },
  }));
  export const FileNotDirectory = ApplicationError.declare(-33003, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' is not a directory.`,
    data: { uri },
  }));
  export const FileIsOutOfSync = ApplicationError.declare(-33004, (file: FileStat, stat: FileStat) => ({
    message: `'${file.uri}' is out of sync.`,
    data: { file, stat },
  }));
  export const FileIsNoPermissions = ApplicationError.declare(-33005, (uri: string, prefix?: string) => ({
    message: `${prefix ? prefix + ' ' : ''}'${uri}' is no permissions.`,
    data: { uri },
  }));
}

export class FileOperationError extends Error {
  constructor(message: string, public fileOperationResult: FileOperationResult, public options?: any) {
    super(message);
  }

  static isFileOperationError(obj: unknown): obj is FileOperationError {
    return obj instanceof Error && !isUndefinedOrNull((obj as FileOperationError).fileOperationResult);
  }
}

export const enum FileOperationResult {
  FILE_IS_DIRECTORY,
  FILE_NOT_FOUND,
  FILE_NOT_MODIFIED_SINCE,
  FILE_MODIFIED_SINCE,
  FILE_MOVE_CONFLICT,
  FILE_READ_ONLY,
  FILE_PERMISSION_DENIED,
  FILE_TOO_LARGE,
  FILE_INVALID_PATH,
  FILE_EXCEEDS_MEMORY_LIMIT,
  FILE_NOT_DIRECTORY,
  FILE_OTHER_ERROR,
}

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
/* tslint:disable callable-types */
export type FileCopyFn = (
  source: Uri,
  destination: Uri,
  options: { overwrite: boolean },
) => void | Thenable<void | FileStat>;

/**
 * @param {(string)} uri
 * @returns {Promise<boolean>}
 */
/* tslint:disable callable-types */
export type FileAccessFn = (uri: Uri, mode: number) => Promise<boolean>;

/* tslint:disable callable-types */
export type FileGetCurrentUserHomeFn = () => Promise<FileStat | undefined>;

/**
 * 返回文件的后缀名，目录则返回 'directory'，找不到则返回 undefined
 * @param uri string
 */
/* tslint:disable callable-types */
export type FileGetFileTypeFn = (uri: string) => Promise<string | undefined>;

interface ExtendedFileFns {
  copy: FileCopyFn;
  access: FileAccessFn;
  getCurrentUserHome: FileGetCurrentUserHomeFn;
  getFileType: FileGetFileTypeFn;
}

/**
 * 判断一个对象是否包含某个方法
 * @param obj object
 * @param prop string
 */
export function containsExtraFileMethod<X extends {}, Y extends keyof ExtendedFileFns>(
  obj: X,
  prop: Y,
): obj is X & Record<Y, ExtendedFileFns[Y]> {
  return hasProperty<X, Y>(obj, prop) && isFunction<ExtendedFileFns[Y]>(obj[prop]);
}

export interface IDiskFileProvider extends FileSystemProvider {
  copy: FileCopyFn;
  access: FileAccessFn;
  getCurrentUserHome: FileGetCurrentUserHomeFn;
  getFileType: FileGetFileTypeFn;
  setWatchFileExcludes(excludes: string[]): void | Thenable<void>;
  getWatchFileExcludes(): string[] | Thenable<string[]>;
}

// tslint:disable-next-line: no-empty-interface
export type IShadowFileProvider = FileSystemProvider;

/**
 * Inner FileSystemProvider：内部实现的 Provider，可以直接在NODE主进程使用的，用FileSystemProvider标记
 * Insert FileSystemProvider: 一般指通过插件API注入进来的 Provider，主进程无法直接使用，用ID来标记，远程调用
 */
export type InnerOrInsertFileSystemProvider = FileSystemProvider | number;

export function notEmpty<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isErrnoException(error: any | NodeJS.ErrnoException): error is NodeJS.ErrnoException {
  return (error as NodeJS.ErrnoException).code !== undefined && (error as NodeJS.ErrnoException).errno !== undefined;
}

export const FILE_SCHEME = 'file';

export interface IFileSystemProviderRegistrationEvent {
  added: boolean;
  scheme: string;
  provider?: FileSystemProvider;
}

export interface IFileSystemProviderCapabilitiesChangeEvent {
  provider: FileSystemProvider;
  scheme: string;
}
