import { Autowired } from '@ali/common-di';
import {
  Domain,
  ResourceResolverContribution,
  URI,
  Resource,
  DisposableCollection,
  Event,
  Emitter,
  ResourceError,
} from '@ali/ide-core-browser';
import { FileServiceClient } from './file-service-client';
import { FileServiceWatcherClient } from './file-service-watcher-client';
import { FileStat, FileSystemError } from '../common';
import { FileChangeEvent } from '../common/file-service-watcher-protocol';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol';

export class FileResource implements Resource {

  protected readonly toDispose = new DisposableCollection();
  protected readonly onDidChangeContentsEmitter = new Emitter<void>();
  readonly onDidChangeContents: Event<void> = this.onDidChangeContentsEmitter.event;

  protected stat: FileStat | undefined;
  protected uriString: string;

  constructor(
    readonly uri: URI,
    protected readonly fileSystem: FileServiceClient,
    protected readonly fileSystemWatcher: FileServiceWatcherClient,
  ) {
    this.uriString = this.uri.toString();
    this.toDispose.push(this.onDidChangeContentsEmitter);
  }

  async init(): Promise<void> {
    const stat = await this.getFileStat();
    if (stat && stat.isDirectory) {
      throw new Error('The given uri is a directory: ' + this.uriString);
    }
    this.stat = stat;
    this.toDispose.push(this.fileSystemWatcher.onFilesChanged((event) => {
      if (FileChangeEvent.isAffected(event, this.uri)) {
        this.sync();
      }
    }));
    try {
      // 隐藏URI中的私有变量防止JSON序列化时循环引用报错
      this.toDispose.push(await this.fileSystemWatcher.watchFileChanges(Object.assign({}, this.uri, {_path: {}})));
    } catch (e) {
      console.error(e);
    }
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  async readContents(options?: { encoding?: string }): Promise<string> {
    try {
      const { stat, content } = await this.fileSystem.resolveContent(this.uriString, options);
      this.stat = stat;
      return content;
    } catch (e) {
      if (FileSystemError.FileNotFound.is(e)) {
        this.stat = undefined;
        throw ResourceError.NotFound({
          ...e.toJson(),
          data: {
            uri: this.uri,
          },
        });
      }
      throw e;
    }
  }

  async saveContents(content: string, options?: { encoding?: string }): Promise<void> {
    this.stat = await this.doSaveContents(content, options);
  }

  protected async doSaveContents(content: string, options?: { encoding?: string }): Promise<FileStat> {
    const stat = await this.getFileStat();
    if (stat) {
      return this.fileSystem.setContent(stat, content, options);
    }
    return this.fileSystem.createFile(this.uriString, { content, ...options });
  }

  async saveContentChanges(changes: TextDocumentContentChangeEvent[], options?: { encoding?: string }): Promise<void> {
    if (!this.stat) {
      throw new Error(this.uriString + ' has not been read yet');
    }
    this.stat = await this.fileSystem.updateContent(this.stat, changes, options);
  }

  protected async sync(): Promise<void> {
    if (await this.isInSync(this.stat)) {
      return;
    }
    this.onDidChangeContentsEmitter.fire(undefined);
  }
  protected async isInSync(current: FileStat | undefined): Promise<boolean> {
    const stat = await this.getFileStat();
    if (!current) {
      return !stat;
    }
    return !!stat && current.lastModification >= stat.lastModification;
  }

  protected async getFileStat(): Promise<FileStat | undefined> {
    if (!await this.fileSystem.exists(this.uriString)) {
      return undefined;
    }
    try {
      return this.fileSystem.getFileStat(this.uriString);
    } catch {
      return undefined;
    }
  }

}

// 常规文件资源读取
@Domain(ResourceResolverContribution)
export class FileResourceResolver implements ResourceResolverContribution {

  @Autowired(FileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired(FileServiceWatcherClient)
  protected readonly fileSystemWatcher: FileServiceWatcherClient;

  async resolve(uri: URI): Promise<FileResource> {
    if (uri.scheme !== 'file') {
      throw new Error('The given uri is not file uri: ' + uri);
    }
    const resource = new FileResource(uri, this.fileSystem, this.fileSystemWatcher);
    await resource.init();
    return resource;
  }

}
