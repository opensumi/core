import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { FileChangeType } from '@ali/ide-file-service';
import {
  URI,
  Emitter,
  DisposableCollection,
  Disposable,
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
  private readonly fsProvider = new Map<number, vscode.FileSystemProvider>();
  private readonly usedSchemes = new Set<string>();
  private schemeId: number = -1;

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
  ): Disposable {
    if (this.usedSchemes.has(scheme)) {
      throw new Error(`a provider for the scheme '${scheme}' is already registered`);
    }
    const id = ++this.schemeId;
    const toDispose = new DisposableCollection();

    this.usedSchemes.add(scheme);
    this.fsProvider.set(id, provider);

    return new Disposable(toDispose);
  }

  // TODO: test
  $stat(uri) {
    console.log('uri', uri);
  }
}
