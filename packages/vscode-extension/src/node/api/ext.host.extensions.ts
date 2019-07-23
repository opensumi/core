import * as vscode from 'vscode';
import * as path from 'path';
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService } from '../../common';
import { VSCExtension } from '../../node/vscode.extension';
import { ExtHostStorage, ExtensionMemento } from './ext.host.storage';

export interface ExtenstionContextOptions {
  rpc: IRPCProtocol;
  extensionId: string;
  storagePath: string;
  extensionPath: string;
  storageProxy: ExtHostStorage;
}

export class ExtenstionContext implements vscode.ExtensionContext {

  readonly subscriptions: { dispose(): any }[] = [];

  readonly extensionPath: string;

  // TODO
  readonly workspaceState: vscode.Memento;

  // TODO
  readonly globalState: vscode.Memento;

  // TODO
  readonly storagePath: string | undefined;

  // TODO
  readonly globalStoragePath: string;

  // TODO
  readonly logPath: string;

  constructor(options: ExtenstionContextOptions) {
    const {
      extensionId,
      extensionPath,
      storageProxy,
    } = options;

    this.extensionPath = extensionPath;

    this.workspaceState = new ExtensionMemento(extensionId, false, storageProxy);
    this.globalState = new ExtensionMemento(extensionId, true, storageProxy);
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
