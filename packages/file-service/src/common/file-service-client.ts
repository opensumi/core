import {
  BaseFileSystemService,
  BinaryBuffer,
  DidFilesChangedParams,
  Event,
  FileChangeEvent,
  FileSetContentOptions,
  FileSystemProviderCapabilities,
  IDisposable,
  IFileServiceWatcher,
  URI,
} from '@opensumi/ide-core-common';

import {
  FileCopyOptions,
  FileCreateOptions,
  FileDeleteOptions,
  FileMoveOptions,
  FileStat,
  FileSystemProvider,
  IFileSystemProviderCapabilitiesChangeEvent,
  IFileSystemProviderRegistrationEvent,
  TextDocumentContentChangeEvent,
} from './files';

export { FileServiceClientToken } from '@opensumi/ide-core-common';

export interface IFileServiceClientService extends BaseFileSystemService {
  onFilesChanged: Event<FileChangeEvent>;

  onFileProviderChanged: Event<string[]>;

  registerProvider(scheme: string, provider: FileSystemProvider): IDisposable;

  handlesScheme(scheme: string): boolean;

  getFileType(uri: string): Promise<string | undefined>;

  updateContent(
    file: FileStat,
    contentChanges: TextDocumentContentChangeEvent[],
    options?: FileSetContentOptions,
  ): Promise<void | FileStat>;

  createFile(uri: string, options?: FileCreateOptions): Promise<FileStat>;

  createFolder(uri: string): Promise<FileStat>;

  access(uri: string, mode?: number): Promise<boolean>;

  move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat>;

  copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat>;

  delete(uri: string, options?: FileDeleteOptions);

  getCurrentUserHome(): Promise<FileStat | undefined>;

  fireFilesChange(event: DidFilesChangedParams): void;

  watchFileChanges(uri: URI, excludes?: string[]): Promise<IFileServiceWatcher>;

  unwatchFileChanges(watchId: number): Promise<void>;

  setWatchFileExcludes(excludes: string[]): Promise<void>;

  getWatchFileExcludes(): Promise<string[]>;

  setFilesExcludes(excludes: string[], roots: string[]): Promise<void>;

  getFsPath(uri: string): Promise<string | undefined>;

  setWorkspaceRoots(roots: string[]): Promise<void>;

  getEncoding(uri: string): Promise<string>;

  isReadonly(uri: string): Promise<boolean>;

  listCapabilities(): Iterable<{ scheme: string; capabilities: FileSystemProviderCapabilities }>;

  readonly onDidChangeFileSystemProviderRegistrations: Event<IFileSystemProviderRegistrationEvent>;

  readonly onDidChangeFileSystemProviderCapabilities: Event<IFileSystemProviderCapabilitiesChangeEvent>;
}

export interface IBrowserFileSystemRegistry {
  registerFileSystemProvider(provider: IFileSystemProvider): IDisposable;
}

export const IBrowserFileSystemRegistry = Symbol('IBrowserFileSystemRegistry');

export interface IFileSystemProvider {
  scheme: string;
}
