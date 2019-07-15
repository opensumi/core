
// import { Event } from '@ali/ide-core-common/lib/event';
import { Injectable, Inject, Autowired } from '@ali/common-di';
import { FileServicePath, IFileService, FileStat, FileDeleteOptions, FileMoveOptions } from '../common/index';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { IDisposable, Disposable, URI, Emitter, Event } from '@ali/ide-core-common';
import { FileChangeEvent, DidFilesChangedParams, FileChange } from '../common/file-service-watcher-protocol';

@Injectable()
export class FileServiceClient {

  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  @Autowired(FileServicePath)
  private fileService;

  async resolveContent(uri: string, options?: { encoding?: string }) {
    return this.fileService.resolveContent(uri, options);
  }

  async getFileStat(uri: string) {
    return this.fileService.getFileStat(uri);
  }
  async getFileType(uri: string) {
    return this.fileService.getFileType(uri);
  }

  async setContent(file: FileStat, content: string, options?: { encoding?: string }) {
    return this.fileService.setContent(file, content, options);
  }

  async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: { encoding?: string }): Promise<FileStat> {
    return this.fileService.updateContent(file, contentChanges, options);
  }

  async createFile(uri: string, options?: { content?: string, encoding?: string }) {
    return this.fileService.createFile(uri, options);
  }

  async createFolder(uri: string): Promise<FileStat> {
    return this.fileService.createFolder(uri);
  }

  async touchFile(uri: string): Promise<FileStat> {
    return this.fileService.touchFile(uri);
  }

  async access(uri: string, mode?: number): Promise<boolean> {
    return this.fileService.access(uri, mode);
  }

  async move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    return this.fileService.move(sourceUri, targetUri, options);
  }

  async copy(sourceUri: string, targetUri: string, options?: { overwrite?: boolean, recursive?: boolean }): Promise<FileStat> {
    return this.fileService.copy(sourceUri, targetUri, options);
  }

  async getCurrentUserHome() {
    return this.fileService.getCurrentUserHome();
  }

  // async onDidFilesChanged(e) {
  //   console.log('file-service-client change event', e);
  // }

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
  async watchFileChanges(uri: URI): Promise<IDisposable> {
    const watcher = await this.fileService.watchFileChanges(uri.toString());
    const toDispose = Disposable.create(() => {
      this.fileService.unwatchFileChanges(watcher);
    });
    return toDispose;
  }

  async delete(uri: string, options?: FileDeleteOptions) {
    return this.fileService.delete(uri, options);
  }

  async exists(uri: string) {
    return this.fileService.exists(uri);
  }

}
