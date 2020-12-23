
import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { FileStat, FileDeleteOptions, FileMoveOptions, IBrowserFileSystemRegistry, IFileSystemProvider, FileSystemProvider, FileSystemError, FileAccess, IDiskFileProvider, containsExtraFileMethod } from '../common';
import { TextDocument } from 'vscode-languageserver-types';
import { URI, Emitter, Event, isElectronRenderer, IEventBus, FileUri, DisposableCollection, IDisposable, TextDocumentContentChangeEvent } from '@ali/ide-core-common';
import { parse, ParsedPattern } from '@ali/ide-core-common/lib/utils/glob';
import Uri from 'vscode-uri';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import {
  FileChangeEvent,
  DidFilesChangedParams,
  FileChange,
  IFileServiceClient,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
  IFileServiceWatcher,
} from '../common';
import { FileSystemWatcher } from './watcher';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { FilesChangeEvent, ExtensionActivateEvent } from '@ali/ide-core-browser';

// TODO: 这里只做标记，实现插件注册的scheme统一走fs-client
@Injectable()
export class BrowserFileSystemRegistryImpl implements IBrowserFileSystemRegistry {

  public readonly providers = new Map<string, IFileSystemProvider>();

  // 这里的 provider 只是一个空 scheme
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
  protected filesExcludesMatcherList: ParsedPattern[] = [];

  protected watcherId: number = 0;
  protected readonly watcherDisposerMap = new Map<number, IDisposable>();
  protected readonly watcherWithSchemaMap = new Map<string, number[]>();
  protected toDisposable = new DisposableCollection();
  protected watchFileExcludes: string[] = [];
  protected watchFileExcludesMatcherList: ParsedPattern[] = [];
  protected filesExcludes: string[] = [];
  protected workspaceRoots: string[] = [];

  // 记录哪些 fsProviders 发生了变更
  private _providerChanged: Set<string> = new Set();

  // TODO: 这个registry只记录了 scheme
  @Autowired(IBrowserFileSystemRegistry)
  private registry: BrowserFileSystemRegistryImpl;
  // FIXME: 融合registry & fsProviders
  private fsProviders: Map<string, FileSystemProvider | IDiskFileProvider> = new Map();

  @Autowired(INJECTOR_TOKEN)
  private injector;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  public options = {
    encoding: 'utf8',
    overwrite: false,
    recursive: true,
    moveToTrash: true,
  };

  corePreferences: CorePreferences;

  constructor() {}

  handlesScheme(scheme: string) {
    return this.registry.providers.has(scheme) || this.fsProviders.has(scheme);
  }

  // 直接先读文件，错误在后端抛出
  async resolveContent(uri: string, options?: FileSetContentOptions) {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);
    const content = await provider.readFile(_uri.codeUri, options?.encoding);
    return { content };
  }

  async getFileStat(uri: string, withChildren: boolean = true) {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);
    return this.filterStat(stat, withChildren);
  }

  async setContent(file: FileStat, content: string, options?: FileSetContentOptions) {
    const _uri = this.getUri(file.uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);

    if (!stat) {
      throw FileSystemError.FileNotFound(file.uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(file.uri, 'Cannot set the content.');
    }
    if (!(await this.isInSync(file, stat))) {
      throw this.createOutOfSyncError(file, stat);
    }
    await provider.writeFile(_uri.codeUri, content, { create: false, overwrite: true, encoding: options?.encoding });
    const newStat = await provider.stat(_uri.codeUri);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(_uri.codeUri.path, 'Error occurred while writing file content.');
  }

  async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: FileSetContentOptions): Promise<FileStat> {
    const _uri = this.getUri(file.uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);
    if (!stat) {
      throw FileSystemError.FileNotFound(file.uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(file.uri, 'Cannot set the content.');
    }
    if (!this.checkInSync(file, stat)) {
      throw this.createOutOfSyncError(file, stat);
    }
    if (contentChanges.length === 0) {
      return stat;
    }
    const content = await provider.readFile(_uri.codeUri);
    const newContent = this.applyContentChanges(content, contentChanges);
    await provider.writeFile(_uri.codeUri, newContent, { create: false, overwrite: true, encoding: options?.encoding });
    const newStat = await provider.stat(_uri.codeUri);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(file.uri, 'Error occurred while writing file content.');
  }

  async createFile(uri: string, options?: FileCreateOptions) {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    const content = await this.doGetContent(options);
    let newStat: any = await provider.writeFile(_uri.codeUri, content, {
      create: true,
      overwrite: options && options.overwrite || false,
      encoding: options?.encoding,
    });
    newStat = newStat || await provider.stat(_uri.codeUri);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri, 'Error occurred while creating the file.');
  }

  async createFolder(uri: string): Promise<FileStat> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    const result = await provider.createDirectory(_uri.codeUri);

    if (result) {
      return result;
    }

    return provider.stat(_uri.codeUri);
  }

  async move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    const _sourceUri = this.getUri(sourceUri);
    const _targetUri = this.getUri(targetUri);

    const provider = await this.getProvider(_sourceUri.scheme);
    const result: any = await provider.rename(_sourceUri.codeUri, _targetUri.codeUri, { overwrite: !!(options && options.overwrite) });

    if (result) {
      return result;
    }
    return await provider.stat(_targetUri.codeUri);
  }

  async copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat> {
    const _sourceUri = this.getUri(sourceUri);
    const _targetUri = this.getUri(targetUri);
    const provider = await this.getProvider(_sourceUri.scheme);
    const overwrite = await this.doGetOverwrite(options);

    if (!containsExtraFileMethod(provider, 'copy')) {
      throw this.getErrorProvideNotSupport(_sourceUri.scheme, 'copy');
    }

    const result = await provider.copy(
      _sourceUri.codeUri,
      _targetUri.codeUri,
      {
        overwrite: !!overwrite,
      });

    if (result) {
      return result;
    }
    return await provider.stat(_targetUri.codeUri);
  }

  async getFsPath(uri: string) {
    if (!uri.startsWith('file:/')) {
      return undefined;
    } else {
      return FileUri.fsPath(uri);
    }
  }

  fireFilesChange(event: DidFilesChangedParams): void {
    const changes: FileChange[] = event.changes.map((change) => {
      return {
        uri: change.uri,
        type: change.type,
      } as FileChange;
    });
    this.onFileChangedEmitter.fire(changes);
    this.eventBus.fire(new FilesChangeEvent(changes));
  }

  // FIXME: watch fix
  // 添加监听文件
  async watchFileChanges(uri: URI, excludes?: string[]): Promise<IFileServiceWatcher> {
    const id = this.watcherId++;
    const _uri = this.getUri(uri.toString());
    const provider = await this.getProvider(_uri.scheme);
    const schemaWatchIdList = this.watcherWithSchemaMap.get(_uri.scheme) || [];

    const watcherId = await provider.watch(uri.codeUri, {
      recursive: true,
      excludes: excludes || [],
    });
    this.watcherDisposerMap.set(id, {
      dispose: () => provider.unwatch && provider.unwatch(watcherId),
    });
    schemaWatchIdList.push(id);
    this.watcherWithSchemaMap.set(
      _uri.scheme,
      schemaWatchIdList,
    );
    return new FileSystemWatcher({
      fileServiceClient: this,
      watchId: id,
      uri,
    });
  }

  async setWatchFileExcludes(excludes: string[]) {
    const provider = await this.getProvider('file');
    return await provider.setWatchFileExcludes(excludes);
  }

  async getWatchFileExcludes() {
    const provider = await this.getProvider('file');
    return await provider.getWatchFileExcludes();
  }

  async setFilesExcludes(excludes: string[], roots?: string[]): Promise<void> {
    this.filesExcludes = excludes;
    this.filesExcludesMatcherList = [];
    if (roots) {
      this.setWorkspaceRoots(roots);
    }
    this.updateExcludeMatcher();
  }

  async setWorkspaceRoots(roots: string[]) {
    this.workspaceRoots = roots;
    this.updateExcludeMatcher();
  }

  async unwatchFileChanges(watcherId: number): Promise<void> {
    const disposable = this.watcherDisposerMap.get(watcherId);
    if (!disposable || !disposable.dispose) {
      return;
    }
    disposable.dispose();
  }

  async delete(uriString: string, options?: FileDeleteOptions) {
    if (isElectronRenderer() && options && options.moveToTrash) {
      const uri = new URI(uriString);
      if (uri.scheme === 'file') {
        return (this.injector.get(IElectronMainUIService) as IElectronMainUIService).moveToTrash(uri.codeUri.fsPath);
      }
    }
    const _uri = this.getUri(uriString);
    const provider = await this.getProvider(_uri.scheme);

    const stat = await provider.stat(_uri.codeUri);
    if (!stat) {
      throw FileSystemError.FileNotFound(uriString);
    }

    await provider.delete(_uri.codeUri, {
      recursive: true,
      moveToTrash: await this.doGetMoveToTrash(options),
    });
  }

  async getEncoding(uri: string): Promise<string> {
    // TODO 临时修复方案 目前识别率太低，全部返回 UTF8
    return 'utf8';
  }

  registerProvider(scheme: string, provider: FileSystemProvider): IDisposable {
    this.fsProviders.set(scheme, provider);
    this.toDisposable.push({
      dispose: () => {
        this.fsProviders.delete(scheme);
        this._providerChanged.add(scheme);
      },
    });
    if (provider.onDidChangeFile) {
      this.toDisposable.push(provider.onDidChangeFile((e) => this.fireFilesChange({changes: e})));
    }
    this.toDisposable.push({
      dispose: () => {
        (this.watcherWithSchemaMap.get(scheme) || []).forEach((id) => this.unwatchFileChanges(id));
      },
    });
    this._providerChanged.add(scheme);
    return this.toDisposable;
  }

  async access(uri: string, mode: number = FileAccess.Constants.F_OK): Promise<boolean> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    if (!containsExtraFileMethod(provider, 'access')) {
      throw this.getErrorProvideNotSupport(_uri.scheme, 'access');
    }

    return await provider.access(_uri.codeUri, mode);
  }

  // 这里需要 try catch 了
  async getFileType(uri: string) {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    if (!containsExtraFileMethod(provider, 'getFileType')) {
      throw this.getErrorProvideNotSupport(_uri.scheme, 'getFileType');
    }

    return await provider.getFileType(uri);
  }

  // TODO: file scheme only?
  async getCurrentUserHome() {
    const provider = await this.getProvider('file');
    return provider.getCurrentUserHome();
  }

  private getErrorProvideNotSupport(scheme: string, funName: string): string {
    return `Scheme ${scheme} not support this function: ${funName}.`;
  }

  private getUri(uri: string | Uri): URI {
    const _uri = new URI(uri);

    if (!_uri.scheme) {
      throw new Error(`没有设置 scheme: ${uri}`);
    }

    return _uri;
  }

  private updateExcludeMatcher() {
    this.filesExcludes.forEach((str) => {
      if (this.workspaceRoots.length > 0) {
        this.workspaceRoots.forEach((root: string) => {
          const uri = new URI(root);
          const uriWithExclude = uri.resolve(str).withoutScheme();
          this.filesExcludesMatcherList.push(parse(uriWithExclude.toString(true)));
        });
      } else {
        this.filesExcludesMatcherList.push(parse(str));
      }
    });
  }

  private async getProvider<T extends string>(scheme: T): Promise<T extends 'file' ? IDiskFileProvider : FileSystemProvider>;
  private async getProvider(scheme: string): Promise<IDiskFileProvider | FileSystemProvider> {

    if (this._providerChanged.has(scheme)) {
      // 让相关插件启动完成 (3秒超时), 此处防止每次都发，仅在相关scheme被影响时才尝试激活插件
      await this.eventBus.fireAndAwait(new ExtensionActivateEvent({ topic: 'onFileSystem', data: scheme }), {timeout: 3000});
      this._providerChanged.delete(scheme);
    }

    const provider = this.fsProviders.get(scheme);

    if (!provider) {
      // Try Init extensionFileSystemManage, if fail will return void!
      // if (!this.extensionFileSystemManage) {
      //   if (this.rpcClient && this.rpcClient[0]) {
      //     this.extensionFileSystemManage = new ExtensionFileSystemManage(this.rpcClient![0]);
      //   }
      // }
      // if (this.extensionFileSystemManage) {
      //   provider = await this.extensionFileSystemManage.get(scheme);
      // }
      throw new Error(`Not find ${scheme} provider.`);
    }

    return provider;
  }

  public async isReadonly(uriString: string): Promise<boolean> {
    try {
      const uri = new URI(uriString);
      const provider = await this.getProvider(uri.scheme);
      return !!provider.readonly;
    } catch (e) {
      // 考虑到非 readonly 变readonly 的情况，相对于 readonly 变不 readonly 来说更为严重
      return false;
    }
  }

  private isExclude(uriString: string) {
    const uri = new URI(uriString);

    return this.filesExcludesMatcherList.some((matcher) => {
      return matcher(uri.withoutScheme().toString(true));
    });
  }

  private filterStat(stat?: FileStat, withChildren: boolean = true) {
    if (!stat) {
      return;
    }
    if (this.isExclude(stat.uri)) {
      return;
    }

    // 这里传了 false 就走不到后面递归逻辑了
    if (stat.children && withChildren) {
      stat.children = this.filterStatChildren(stat.children);
    }

    return stat;
  }

  private filterStatChildren(children: FileStat[]) {
    const list: FileStat[] = [];

    children.forEach((child) => {
      if (this.isExclude(child.uri)) {
        return false;
      }
      const state = this.filterStat(child);
      if (state) {
        list.push(state);
      }
    });

    return list;
  }

  protected applyContentChanges(content: string, contentChanges: TextDocumentContentChangeEvent[]): string {
    let document = TextDocument.create('', '', 1, content);
    for (const change of contentChanges) {
      let newContent = change.text;
      if (change.range) {
        const start = document.offsetAt(change.range.start);
        const end = document.offsetAt(change.range.end);
        newContent = document.getText().substr(0, start) + change.text + document.getText().substr(end);
      }
      document = TextDocument.create(document.uri, document.languageId, document.version, newContent);
    }
    return document.getText();
  }

  protected async isInSync(file: FileStat, stat: FileStat): Promise<boolean> {
    if (this.checkInSync(file, stat)) {
      return true;
    }
    return false;
  }

  protected checkInSync(file: FileStat, stat: FileStat): boolean {
    return stat.lastModification === file.lastModification && stat.size === file.size;
  }

  protected createOutOfSyncError(file: FileStat, stat: FileStat): Error {
    return FileSystemError.FileIsOutOfSync(file, stat);
  }

  protected async doGetEncoding(option?: { encoding?: string }): Promise<string> {
    return option && typeof (option.encoding) !== 'undefined'
      ? option.encoding
      : this.options.encoding;
  }

  protected async doGetOverwrite(option?: { overwrite?: boolean }): Promise<boolean | undefined> {
    return option && typeof (option.overwrite) !== 'undefined'
      ? option.overwrite
      : this.options.overwrite;
  }

  protected async doGetRecursive(option?: { recursive?: boolean }): Promise<boolean> {
    return option && typeof (option.recursive) !== 'undefined'
      ? option.recursive
      : this.options.recursive;
  }

  protected async doGetMoveToTrash(option?: { moveToTrash?: boolean }): Promise<boolean> {
    return option && typeof (option.moveToTrash) !== 'undefined'
      ? option.moveToTrash
      : this.options.moveToTrash;
  }

  protected async doGetContent(option?: { content?: string }): Promise<string> {
    return (option && option.content) || '';
  }

}
