import { Injectable } from '@opensumi/di';
import { URI, Emitter, Event, FileUri, IDisposable, BinaryBuffer } from '@opensumi/ide-core-common';

import { IFileServiceClient } from '../src/common/file-service-client';
import {
  DidFilesChangedParams,
  FileChange,
  FileChangeEvent,
  FileCopyOptions,
  FileCreateOptions,
  FileDeleteOptions,
  FileMoveOptions,
  FileSetContentOptions,
  FileStat,
  FileSystemProvider,
  FileWatcherFailureParams,
  FileWatcherOverflowParams,
  TextDocumentContentChangeEvent,
} from '../src/common/files';
import { IFileServiceWatcher } from '../src/common/watcher';

@Injectable()
export class MockFileServiceClient implements IFileServiceClient {
  initialize?: (() => Promise<void>) | undefined;
  reconnect(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  dispose(): void {
    throw new Error('Method not implemented.');
  }
  shouldWaitProvider(scheme: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  listCapabilities() {
    return [];
  }
  onWillActivateFileSystemProvider = Event.None;
  onDidChangeFileSystemProviderRegistrations = Event.None;
  onDidChangeFileSystemProviderCapabilities = Event.None;

  registerProvider(scheme: string, provider: FileSystemProvider): IDisposable {
    throw new Error('Method not implemented.');
  }

  async isReadonly() {
    return false;
  }

  defaultMockFileStat: FileStat = {
    uri: '',
    isDirectory: false,
    lastModification: 0,
  };

  private watchExcludes: string[];
  // @ts-ignore
  private fileExcludes: string[];

  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  protected readonly onFileProviderChangedEmitter = new Emitter<string[]>();
  readonly onFileProviderChanged: Event<string[]> = this.onFileProviderChangedEmitter.event;

  protected readonly onWatcherOverflowEmitter = new Emitter<FileWatcherOverflowParams>();
  readonly onWatcherOverflow: Event<FileWatcherOverflowParams> = this.onWatcherOverflowEmitter.event;

  protected readonly onWatcherFailedEmitter = new Emitter<FileWatcherFailureParams>();
  readonly onWatcherFailed: Event<FileWatcherFailureParams> = this.onWatcherFailedEmitter.event;

  handlesScheme(scheme: string) {
    return true;
  }

  async resolveContent(uri: string, options?: FileSetContentOptions) {
    return {
      content: '',
    };
  }

  async readFile(uri: string) {
    return {
      content: BinaryBuffer.fromString(''),
    };
  }

  async getFileStat(uri: string) {
    return {
      uri,
      isDirectory: false,
      lastModification: 0,
    };
  }
  async getFileType(uri: string) {
    return '';
  }

  async setContent(file: FileStat, content: string, options?: FileSetContentOptions) {
    return file;
  }

  async updateContent(
    file: FileStat,
    contentChanges: TextDocumentContentChangeEvent[],
    options?: FileSetContentOptions,
  ): Promise<FileStat> {
    return file;
  }

  async createFile(uri: string, options?: FileCreateOptions) {
    return {
      uri,
      isDirectory: false,
      lastModification: 0,
    };
  }

  async createFolder(uri: string): Promise<FileStat> {
    return {
      uri,
      isDirectory: true,
      lastModification: 0,
    };
  }

  async access(uri: string, mode?: number): Promise<boolean> {
    return true;
  }

  async move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    return {
      uri: targetUri,
      isDirectory: true,
      lastModification: 0,
    };
  }

  async copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat> {
    return {
      uri: targetUri,
      isDirectory: true,
      lastModification: 0,
    };
  }

  async getCurrentUserHome() {
    return {
      uri: 'file://userhome',
      isDirectory: true,
      lastModification: 0,
    };
  }

  async getFsPath(uri: string) {
    if (!uri.startsWith('file:/')) {
      return undefined;
    } else {
      return FileUri.fsPath(uri);
    }
  }

  fireFilesChange(event: DidFilesChangedParams): void {
    const changes: FileChange[] = event.changes.map(
      (change) =>
        ({
          uri: change.uri,
          type: change.type,
        } as FileChange),
    );
    this.onFileChangedEmitter.fire(changes);
  }

  fireWatcherOverflow(event: FileWatcherOverflowParams): void {
    this.onWatcherOverflowEmitter.fire(event);
  }

  fireWatcherFailed(event: FileWatcherFailureParams): void {
    this.onWatcherFailedEmitter.fire(event);
  }

  // 添加监听文件
  async watchFileChanges(uri: URI): Promise<IFileServiceWatcher> {
    return {
      watchId: 0,
      onFilesChanged: () => ({
        dispose: () => {},
      }),
      dispose: async () => {},
    };
  }

  async setWatchFileExcludes(excludes: string[]) {
    this.watchExcludes = excludes;
    return;
  }

  async getWatchFileExcludes() {
    return this.watchExcludes;
  }

  async setFilesExcludes(excludes: string[], roots?: string[]): Promise<void> {
    this.fileExcludes = excludes;
    return;
  }

  async setWorkspaceRoots(roots: string[]) {
    return;
  }

  async unwatchFileChanges(watchId: number): Promise<void> {
    return;
  }

  async delete(uriString: string, options?: FileDeleteOptions) {
    return;
  }

  async getEncoding(uri: string) {
    return 'utf8';
  }

  async getEncodingInfo(encoding: string) {
    return {
      labelLong: 'UTF-8',
      labelShort: 'UTF-8',
      id: 'utf8',
    };
  }
}
