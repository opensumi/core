import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import {
  FileChangeType,
  FileChangeEvent,
  FileChange,
} from '@ali/ide-file-service';
import {
  URI,
  Emitter,
  DisposableCollection,
  IDisposable,
  Schemas,
} from '@ali/ide-core-common';
import {
  MainThreadAPIIdentifier,
} from '../../common';
import {
  IExtHostFileSystem,
  IMainThreadFileSystem,
  ExtFileChangeEventInfo,
  ExtFileSystemWatcherOptions,
} from '@ali/ide-file-service/lib/common/ext-file-system';

export function createFileSystemApiFactory(
  extHostFileSystem: IExtHostFileSystem,
) {
  return {
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
      this.fireProvidersFilesChange(this.canvertToKtFileChangeEvent(e));
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

    await provider[funName].apply(this, args);
  }

  private canvertToKtFileChangeEvent(events: vscode.FileChangeEvent[]): FileChangeEvent {
    const result: FileChangeEvent = [];

    events.forEach((event: vscode.FileChangeEvent ) => {
      const newEvent = {
        uri: event.uri.toString(),
        type: FileChangeType.UPDATED,
      };
      if (event.type === vscode.FileChangeType.Deleted) {
        newEvent.type = FileChangeType.DELETED;
      }
      if (event.type === vscode.FileChangeType.Created) {
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
