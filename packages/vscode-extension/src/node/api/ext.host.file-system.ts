import * as vscode from 'vscode';
import { URI, Emitter, parse, DisposableCollection } from '@ali/ide-core-common';
import { IRPCProtocol } from '@ali/ide-connection';
import { FileChangeType } from '@ali/ide-file-service';
import {
  MainThreadAPIIdentifier,
  IExtHostFileSystem,
  IMainThreadFileSystem,
  FilechangeEventInfo,
  FileSystemWatcherOptions,
} from '../../common';

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

  constructor(options: FileSystemWatcherOptions, extFileSystem: IExtHostFileSystem) {
    this.extFileSystem = extFileSystem;
    this.ignoreCreateEvents = options.ignoreCreateEvents;
    this.ignoreChangeEvents = options.ignoreChangeEvents;
    this.ignoreDeleteEvents = options.ignoreDeleteEvents;

    this.extFileSystem.subscribeWatcher(options).then((id) => this.id = id);

    this.toDispose.push(extFileSystem.onDidChange((info: FilechangeEventInfo) => {
      if (info.id !== this.id) {
        return;
      }
      if (info.event.type === FileChangeType.ADDED) {
        this.createEmitter.fire(new URI(info.event.uri).codeUri);
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
  private watchEmitter = new Emitter<FilechangeEventInfo>();

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadFileSystem);
  }

  $onFileEvent(options: FilechangeEventInfo) {
    this.watchEmitter.fire(options);
  }

  get onDidChange() {
    return this.watchEmitter.event;
  }

  async subscribeWatcher(options: FileSystemWatcherOptions): Promise<number> {
    return await this.proxy.$subscribeWatcher(options);
  }

  async unsubscribeWatcher(id: number): Promise<void> {
    await this.proxy.$unsubscribeWatcher(id);
  }
}
