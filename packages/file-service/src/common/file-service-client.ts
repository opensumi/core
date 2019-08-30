import { IDisposable, URI, Event, IFileServiceClient as IFileServiceClientToken } from '@ali/ide-core-common';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { FileStat,
  FileMoveOptions,
  FileDeleteOptions,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
} from './files';
import { DidFilesChangedParams, FileChangeEvent, WatchOptions } from './file-service-watcher-protocol';

export const IFileServiceClient = IFileServiceClientToken;

export interface IFileServiceClient {
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

  watchFileChanges(uri: URI, options?: WatchOptions): Promise<IDisposable>;

  exists(uri: string): Promise<boolean>;

  fireFilesChange(e: FileChangeEvent): Promise<void>;

  onFilesChanged: Event<FileChangeEvent>;
}
