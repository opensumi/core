import { IFileServiceClient } from '../file-service-client';
import { URI, Emitter, Event, FileUri } from '@ali/ide-core-common';
import { FileChangeEvent, DidFilesChangedParams, FileChange } from '../file-service-watcher-protocol';
import { FileSetContentOptions, FileStat, FileMoveOptions, FileCreateOptions, FileCopyOptions, FileDeleteOptions } from '../files';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { IFileServiceWatcher } from '../watcher';
import { Injectable } from '@ali/common-di';

@Injectable()
export class MockFileServiceClient implements IFileServiceClient {

  defaultMockFileStat: FileStat = {
    uri: '',
    isDirectory: false,
    lastModification: 0,
  };

  private watchExcludes: string[];
  private fileExcludes: string[];

  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  handlesScheme(scheme: string) {
    return true;
  }

  async resolveContent(uri: string, options?: FileSetContentOptions) {
    return {
      stat: this.defaultMockFileStat,
      content: '',
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

  async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: FileSetContentOptions): Promise<FileStat> {
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

  onDidFilesChanged(event: DidFilesChangedParams): void {
    const changes: FileChange[] = event.changes.map((change) => {
      return {
        uri: change.uri,
        type: change.type,
      } as FileChange;
    });
    this.onFileChangedEmitter.fire(changes);
  }

  // 添加监听文件
  async watchFileChanges(uri: URI): Promise<IFileServiceWatcher> {
    return {
      watchId: 0,
      onFilesChanged: () => {
        return {
          dispose: () => {},
        };
      },
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
    return ;
  }

  async delete(uriString: string, options?: FileDeleteOptions) {
    return;
  }

  async exists(uri: string) {
    return true;
  }

  async fireFilesChange(e: FileChangeEvent) {
    return;
  }
}
