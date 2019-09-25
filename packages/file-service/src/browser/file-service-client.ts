
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { FileServicePath, FileStat, FileDeleteOptions, FileMoveOptions, IBrowserFileSystemRegistry, IFileSystemProvider } from '../common/index';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { URI, Emitter, Event, isElectronRenderer } from '@ali/ide-core-common';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import {
  FileChangeEvent,
  DidFilesChangedParams,
  FileChange,
  IFileServiceClient,
  IFileService,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
  IFileServiceWatcher,
} from '../common';
import { FileSystemWatcher } from './watcher';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';

@Injectable()
export class BrowserFileSystemRegistryImpl implements IBrowserFileSystemRegistry {

  public readonly providers = new Map<string, IFileSystemProvider>();

  registerFileSystemProvider(provider: IFileSystemProvider) {
    const scheme = provider.scheme;
    this.providers.set(scheme, provider);
    return {
      dispose: () => {
        this.providers.delete(scheme);
      },
    };
  }

}

@Injectable()
export class FileServiceClient implements IFileServiceClient {
  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  @Autowired(FileServicePath)
  private fileService: IFileService;

  @Autowired(IBrowserFileSystemRegistry)
  private registry: BrowserFileSystemRegistryImpl;

  @Autowired(INJECTOR_TOKEN)
  private inject;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  corePreferences: CorePreferences;

  handlesScheme(scheme: string) {
    return this.registry.providers.has(scheme);
  }

  async resolveContent(uri: string, options?: FileSetContentOptions) {
    return this.fileService.resolveContent(uri, options);
  }

  async getFileStat(uri: string) {
    await this.setFilesExcludesAndWatchOnce();
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

  async setFilesExcludes(excludes: string[]): Promise<void> {
    return this.fileService.setFilesExcludes(excludes);
  }

  async unwatchFileChanges(watchId: number): Promise<void> {
    return this.fileService.unwatchFileChanges(watchId);
  }

  async delete(uriString: string, options?: FileDeleteOptions) {
    if (isElectronRenderer() && options && options.moveToTrash) {
      const uri = new URI(uriString);
      if (uri.scheme === 'file') {
        (this.inject.get(IElectronMainUIService) as IElectronMainUIService).moveToTrash(uri.codeUri.fsPath);
      }
    }
    return this.fileService.delete(uriString, options);
  }

  async exists(uri: string) {
    return this.fileService.exists(uri);
  }

  async fireFilesChange(e: FileChangeEvent) {
    this.fileService.fireFilesChange(e);
  }

  private getPreferenceFilesExcludes(): string[] {
    const excludes: string[] = [];
    const fileExcludes = this.corePreferences['files.exclude'];
    for (const key of Object.keys(fileExcludes)) {
      if (fileExcludes[key]) {
        excludes.push(key);
      }
    }
    return excludes;
  }

  private async setFilesExcludesAndWatchOnce() {
    if (this.corePreferences) {
      return;
    }
    this.corePreferences = this.inject.get(CorePreferences);
    await this.setFilesExcludes(this.getPreferenceFilesExcludes());

    this.corePreferences.onPreferenceChanged((e) => {
      if (e.preferenceName === 'files.exclude') {
        this.setFilesExcludes(this.getPreferenceFilesExcludes());
      }
    });
  }
}
