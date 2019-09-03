
import { Injectable, Autowired } from '@ali/common-di';
import { FileServicePath, FileStat, FileDeleteOptions, FileMoveOptions } from '../common/index';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { URI, Emitter, Event } from '@ali/ide-core-common';
import {
  FileChangeEvent,
  DidFilesChangedParams,
  FileChange,
  IFileServiceClient,
  IFileService,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
  WatchOptions,
  IFileServiceWatcher,
  FileServiceWatcherOptions,
} from '../common';
import { FileSystemWatcher } from './watcher';

@Injectable()
export class FileServiceClient implements IFileServiceClient {
  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  @Autowired(FileServicePath)
  private fileService: IFileService;

  async resolveContent(uri: string, options?: FileSetContentOptions) {
    return this.fileService.resolveContent(uri, options);
  }

  async getFileStat(uri: string) {
    return this.fileService.getFileStat(uri);
  }
  async getFileType(uri: string) {
    return this.fileService.getFileType(uri);
  }

  async setContent(file: FileStat, content: string, options?: FileSetContentOptions) {
    return this.fileService.setContent(file, content, options);
  }

  async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: FileSetContentOptions): Promise<FileStat> {
    return this.fileService.updateContent(file, contentChanges, options);
  }

  async createFile(uri: string, options?: FileCreateOptions) {
    return this.fileService.createFile(uri, options);
  }

  async createFolder(uri: string): Promise<FileStat> {
    return this.fileService.createFolder(uri);
  }

  async access(uri: string, mode?: number): Promise<boolean> {
    return this.fileService.access(uri, mode);
  }

  async move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    return this.fileService.move(sourceUri, targetUri, options);
  }

  async copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat> {
    return this.fileService.copy(sourceUri, targetUri, options);
  }

  async getCurrentUserHome() {
    return this.fileService.getCurrentUserHome();
  }

  async getFsPath(uri: string) {
    return this.fileService.getFsPath(uri);
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
    const watchId = await this.fileService.watchFileChanges(uri.toString());
    return new FileSystemWatcher({
      fileServiceClient: this,
      watchId,
      uri,
    });
  }

  async setWatchFileExcludes(excludes: string[]) {
    return this.fileService.setWatchFileExcludes(excludes);
  }

  async getWatchFileExcludes() {
    return this.fileService.getWatchFileExcludes();
  }

  async unwatchFileChanges(watchId: number): Promise<void> {
    return this.fileService.unwatchFileChanges(watchId);
  }

  async delete(uri: string, options?: FileDeleteOptions) {
    return this.fileService.delete(uri, options);
  }

  async exists(uri: string) {
    return this.fileService.exists(uri);
  }

  async fireFilesChange(e: FileChangeEvent) {
    this.fileService.fireFilesChange(e);
  }
}
