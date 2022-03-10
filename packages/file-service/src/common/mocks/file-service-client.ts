import { Injectable } from '@opensumi/di';
import { URI, Emitter, Event, FileUri, IDisposable } from '@opensumi/ide-core-common';
import { BinaryBuffer } from '@opensumi/ide-core-common/lib/utils/buffer';

import { FileChangeEvent, DidFilesChangedParams, FileChange } from '..';
import { IFileServiceClient } from '../file-service-client';
import {
  FileSetContentOptions,
  FileStat,
  FileMoveOptions,
  FileCreateOptions,
  FileCopyOptions,
  FileDeleteOptions,
  FileSystemProvider,
  TextDocumentContentChangeEvent,
} from '../files';
import { IFileServiceWatcher } from '../watcher';


@Injectable()
export class MockFileServiceClient implements IFileServiceClient {
  listCapabilities() {
    return [];
  }
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

  // 添加监听文件
  async watchFileChanges(uri: URI): Promise<IFileServiceWatcher> {
    return {
      watchId: 0,
      onFilesChanged: () => ({
        dispose: () => {},
      }),
      dispose: () => {},
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
