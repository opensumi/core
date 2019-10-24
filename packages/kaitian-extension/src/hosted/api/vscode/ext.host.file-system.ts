import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import {
  FileChangeType,
  FileChangeEvent,
  VSCFileChangeType,
  FileSystemProvider,
  FileStat,
  FileType,
} from '@ali/ide-file-service';
import { DiskFileSystemProviderWithoutWatcherForExtHost } from '@ali/ide-file-service/lib/node/disk-file-system.provider';
import {
  URI,
  Emitter,
  DisposableCollection,
  IDisposable,
  Schemas,
  Uri,
} from '@ali/ide-core-common';
import {
  MainThreadAPIIdentifier,
} from '../../../common/vscode';
import {
  IExtHostFileSystem,
  IMainThreadFileSystem,
  ExtFileChangeEventInfo,
  ExtFileSystemWatcherOptions,
  VSCFileStat,
  VSCFileType,
} from '@ali/ide-file-service/lib/common/ext-file-system';

export function createFileSystemApiFactory(
  extHostFileSystem: IExtHostFileSystem,
) {
  return {
    fs: new VSCFileSystem(),
    createFileSystemWatcher(
      globPattern: vscode.GlobPattern,
      ignoreCreateEvents?: boolean,
      ignoreChangeEvents?: boolean,
      ignoreDeleteEvents?: boolean,
    ): vscode.FileSystemWatcher {
      return new FileSystemWatcher({
        globPattern,
        ignoreCreateEvents: !!ignoreCreateEvents,
        ignoreChangeEvents: !!ignoreChangeEvents,
        ignoreDeleteEvents: !!ignoreDeleteEvents,
      }, extHostFileSystem);
    },
    registerFileSystemProvider: extHostFileSystem.registerFileSystemProvider.bind(extHostFileSystem),
  };
}

export function convertToVSCFileStat(stat: FileStat): vscode.FileStat {
  return {
    type: stat.type || 0,
    ctime: stat.createTime || -1,
    mtime: stat.lastModification,
    size: stat.size || 0,
  };
}

export class VSCFileSystem implements vscode.FileSystem {
  innerFs: DiskFileSystemProviderWithoutWatcherForExtHost;

  constructor() {
    this.innerFs = new DiskFileSystemProviderWithoutWatcherForExtHost();
  }

  async stat(uri: Uri): Promise<vscode.FileStat> {
    const state = await this.innerFs.stat(uri);
    return convertToVSCFileStat(state);
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    try {
      return await this.innerFs.readDirectory(uri);
    } catch (e) {
      return [];
    }
  }

  async createDirectory(uri: Uri): Promise<void> {
    try {
      await this.innerFs.createDirectory(uri);
    } catch (e) {}
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    try {
      return await this.innerFs.readFile(uri);
    } catch (e) {
      return new Uint8Array();
    }
  }

  async writeFile(uri: Uri, content: Uint8Array, options?: { create: boolean, overwrite: boolean }): Promise<void> {
    options = Object.assign({}, options, {
      create: true,
      overwrite: true,
    });
    try {
      await this.innerFs.writeFile(
        uri,
        Buffer.from(content),
        options,
      );
    } catch (e) {}
  }

  async delete(uri: Uri, options?: { recursive: boolean }): Promise<void> {
    options = Object.assign({}, options, {
      recursive: true,
    });
    try {
      return await this.innerFs.delete(uri, options);
    } catch (e) {}
  }

  async rename(source: Uri, target: Uri, options?: { overwrite: boolean }): Promise<void> {
    options = Object.assign({}, options, {
      overwrite: true,
    });
    try {
      await this.innerFs.rename(source, target, options);
    } catch (e) {}
  }

  async copy(source: Uri, target: Uri, options?: { overwrite: boolean }): Promise<void> {
    options = Object.assign({}, options, {
      overwrite: true,
    });
    try {
      await this.innerFs.copy(source, target, options);
    } catch (e) {}
  }
}

export class FileSystemWatcher implements vscode.FileSystemWatcher {
  private readonly toDispose = new DisposableCollection();
  private readonly extFileSystem: IExtHostFileSystem;
  private id: number;

  protected createEmitter = new Emitter<vscode.Uri>();
  protected changeEmitter = new Emitter<vscode.Uri>();
  protected deleteEmitter = new Emitter<vscode.Uri>();

  ignoreCreateEvents: boolean;
  ignoreChangeEvents: boolean;
  ignoreDeleteEvents: boolean;

  constructor(options: ExtFileSystemWatcherOptions, extFileSystem: IExtHostFileSystem) {
    this.extFileSystem = extFileSystem;
    this.ignoreCreateEvents = options.ignoreCreateEvents;
    this.ignoreChangeEvents = options.ignoreChangeEvents;
    this.ignoreDeleteEvents = options.ignoreDeleteEvents;

    this.extFileSystem.subscribeWatcher(options).then((id) => this.id = id);

    this.toDispose.push(extFileSystem.onDidChange((info: ExtFileChangeEventInfo) => {
      if (info.id !== this.id) {
        return;
      }
      if (info.event.type === FileChangeType.ADDED) {
        this.createEmitter.fire(new URI(info.event.uri).codeUri);
      }
      if (info.event.type === FileChangeType.UPDATED) {
        this.changeEmitter.fire(new URI(info.event.uri).codeUri);
      }
      if (info.event.type === FileChangeType.DELETED) {
        this.deleteEmitter.fire(new URI(info.event.uri).codeUri);
      }
    }));
  }

  get onDidCreate(): vscode.Event<vscode.Uri> {
    return this.createEmitter.event;
  }
  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.changeEmitter.event;
  }
  get onDidDelete(): vscode.Event<vscode.Uri> {
    return this.deleteEmitter.event;
  }

  dispose() {
    this.toDispose.dispose();
    this.extFileSystem.unsubscribeWatcher(this.id).then();
  }
}

export class ExtHostFileSystem implements IExtHostFileSystem {
  private rpcProtocol: IRPCProtocol;
  private proxy: IMainThreadFileSystem;
  private readonly watchEmitter = new Emitter<ExtFileChangeEventInfo>();
  private readonly fsProviders = new Map<string, vscode.FileSystemProvider>();
  private readonly usedSchemes = new Set<string>();
  private readonly fsProvidersWatcherDisposerMap = new Map<number, IDisposable>();
  private fsProvidersWatchId: number = 0;

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadFileSystem);
    this.initUsedSchems();
  }

  private initUsedSchems() {
    this.usedSchemes.add(Schemas.file);
    this.usedSchemes.add(Schemas.untitled);
    this.usedSchemes.add(Schemas.vscode);
    this.usedSchemes.add(Schemas.inMemory);
    this.usedSchemes.add(Schemas.internal);
    this.usedSchemes.add(Schemas.http);
    this.usedSchemes.add(Schemas.https);
    this.usedSchemes.add(Schemas.mailto);
    this.usedSchemes.add(Schemas.data);
    this.usedSchemes.add(Schemas.command);
  }

  $onFileEvent(options: ExtFileChangeEventInfo) {
    this.watchEmitter.fire(options);
  }

  get onDidChange() {
    return this.watchEmitter.event;
  }

  async subscribeWatcher(options: ExtFileSystemWatcherOptions): Promise<number> {
    return await this.proxy.$subscribeWatcher(options);
  }

  async unsubscribeWatcher(id: number): Promise<void> {
    await this.proxy.$unsubscribeWatcher(id);
  }

  /**
   * Not support `options`, will ignore!
   */
  registerFileSystemProvider(
    scheme: string,
    provider: vscode.FileSystemProvider,
    options: { isCaseSensitive?: boolean, isReadonly?: boolean } = {},
  ): IDisposable {
    if (this.usedSchemes.has(scheme)) {
      throw new Error(`a provider for the scheme '${scheme}' is already registered`);
    }
    const toDisposable = new DisposableCollection();

    this.fsProviders.set(scheme, provider);
    this.usedSchemes.add(scheme);

    toDisposable.push(provider.onDidChangeFile((e: vscode.FileChangeEvent[]) => {
      this.fireProvidersFilesChange(this.convertToKtFileChangeEvent(e));
    }));
    toDisposable.push({
      dispose: () => {
         this.fsProviders.delete(scheme);
         this.usedSchemes.delete(scheme);
      },
    });

    return toDisposable;
  }

  haveProvider(scheme: string): boolean {
    return this.fsProviders.has(scheme);
  }

  async $haveProvider(scheme: string): Promise<boolean> {
    return await this.haveProvider(scheme);
  }

  async $runProviderMethod(scheme: string, funName: string, args: any[]) {
    const provider = this.fsProviders.get(scheme);

    if (!provider) {
      throw new Error(`Not find ${scheme} provider!`);
    }

    if (!provider[funName]) {
      throw new Error(`Not find menthod ${funName}`);
    }

    if (funName === 'rename' || funName === 'copy') {
      args[0] = Uri.parse(args[0]);
      args[1] = Uri.parse(args[1]);
    } else {
      args[0] = Uri.parse(args[0]);
    }

    if (funName === 'stat') {
      try {
        return await this.getStat(provider, args[0]);
      } catch (e) {
        return;
      }
    }

    return await provider[funName].apply(provider, args);
  }

  async getStat(provider: vscode.FileSystemProvider, uri: Uri): Promise<FileStat> {
    return await this.convertToKtStat(provider, uri);
  }

  async $watchFileWithProvider(uri: string, options: { recursive: boolean; excludes: string[] }): Promise<number> {
    const _codeUri = Uri.parse(uri);
    const scheme = _codeUri.scheme;
    const provider = this.fsProviders.get(scheme);

    if (!provider) {
      throw new Error(`Not find ${scheme} provider!`);
    }
    const id = this.fsProvidersWatchId++;
    this.fsProvidersWatcherDisposerMap.set(
      id,
      provider.watch(_codeUri, options),
    );

    return id;
  }

  async $unWatchFileWithProvider(id: number) {
    const disposable = this.fsProvidersWatcherDisposerMap.get(id);
    if (disposable && disposable.dispose) {
      disposable.dispose();
    }
  }

  private async convertToKtStat(
    provider: vscode.FileSystemProvider,
    uri: Uri,
  ): Promise<FileStat> {
    const stat = await provider.stat(uri);
    const isSymbolicLink = stat.type.valueOf() === VSCFileType.SymbolicLink.valueOf();
    const isDirectory = stat.type.valueOf() === VSCFileType.Directory.valueOf();

    const result: FileStat = {
      uri: uri.toString(),
      lastModification: stat.mtime,
      createTime: stat.ctime,
      isSymbolicLink,
      isDirectory,
      size: stat.size,
    };

    if (isDirectory) {
      result.children = await this.convertToKtDirectoryStat(provider, uri);
    }

    return result;
  }

  private async convertToKtDirectoryStat(
    provider: vscode.FileSystemProvider,
    uri: Uri,
  ): Promise<FileStat[]> {
    const outChilen: FileStat[] = [];
    const childen = await provider.readDirectory(uri);

    for (const child of childen) {
      outChilen.push(await this.convertToKtStat(provider, Uri.parse(uri.toString() + `/${child[0]}`)));
    }

    return outChilen;
  }

  private convertToKtFileChangeEvent(events: vscode.FileChangeEvent[]): FileChangeEvent {
    const result: FileChangeEvent = [];

    events.forEach((event: vscode.FileChangeEvent ) => {
      const newEvent = {
        uri: event.uri.toString(),
        type: FileChangeType.UPDATED,
      };
      if (event.type.valueOf() === VSCFileChangeType.Deleted.valueOf()) {
        newEvent.type = FileChangeType.DELETED;
      }
      if (event.type.valueOf() === VSCFileChangeType.Created.valueOf()) {
        newEvent.type = FileChangeType.ADDED;
      }
      result.push(newEvent);
    });

    return result;
  }

  private fireProvidersFilesChange(e: FileChangeEvent) {
    return this.proxy.$fireProvidersFilesChange(e);
  }
}
