import * as vscode from 'vscode';
import * as path from 'path';
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService } from '../../common';
import { VSCExtension } from '../../node/vscode.extension';
import { ExtensionMemento, ExtHostStorage } from './ext.host.storage';

export interface ExtenstionContextOptions {
  extensionId: string;
  extensionPath: string;
  storageProxy: ExtHostStorage;
}

export class ExtenstionContext implements vscode.ExtensionContext {

  readonly subscriptions: { dispose(): any }[] = [];

  readonly extensionPath: string;

  readonly workspaceState: ExtensionMemento;

  readonly globalState: ExtensionMemento;

  private _storage: ExtHostStorage;

  constructor(options: ExtenstionContextOptions) {
    const {
      extensionId,
      extensionPath,
      storageProxy,
    } = options;
    this._storage = storageProxy;

    this.extensionPath = extensionPath;
    this.workspaceState = new ExtensionMemento(extensionId, false, storageProxy);
    this.globalState = new ExtensionMemento(extensionId, true, storageProxy);
  }

  get storagePath() {
    return this._storage.storagePath.storagePath;
  }

  get logPath() {
    return this._storage.storagePath.logPath;
  }

  get globalStoragePath() {
    return this._storage.storagePath.globalStoragePath;
  }

  asAbsolutePath(relativePath: string): string {
    return path.join(this.extensionPath, relativePath);
  }
}

export function createExtensionsApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {

  return {
    all: (() => {
      const extensions = extensionService.getExtensions();
      return extensions.map((ext) => {
        return new VSCExtension(ext, extensionService);
      });
    })(),
    get onDidChange() {
      return extensionService.extensionsChangeEmitter.event;
    },
    getExtension(extensionId: string) {
      return extensionService.getExtension(extensionId);
    },
  };
}
