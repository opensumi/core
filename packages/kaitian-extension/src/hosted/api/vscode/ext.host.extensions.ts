import * as vscode from 'vscode';
import * as path from 'path';
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionHostService, IExtendProxy } from '../../../common';
import { VSCExtension } from '../../vscode.extension'; // '../../node/vscode.extension';
import { ExtensionMemento, ExtHostStorage } from './ext.host.storage';
import { VSCodeExtensionService } from '../../../common/vscode';

export interface ExtenstionContextOptions {
  extensionId: string;
  extensionPath: string;
  storageProxy: ExtHostStorage;
  extendProxy?: IExtendProxy;
  registerExtendModuleService?: (exportsData: any) => void;
}

export class ExtenstionContext implements vscode.ExtensionContext {

  readonly subscriptions: { dispose(): any }[] = [];

  readonly extensionPath: string;

  readonly workspaceState: ExtensionMemento;

  readonly globalState: ExtensionMemento;

  private _storage: ExtHostStorage;

  public componentProxy: IExtendProxy | undefined;
  public registerExtendModuleService: ((exportsData: any) => void) | undefined;

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
    this.componentProxy = options.extendProxy;
    this.registerExtendModuleService = options.registerExtendModuleService;
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
  extensionService: IExtensionHostService,
  mainThreadExtensionService: VSCodeExtensionService,
) {

  return {
    all: (() => {
      const extensions = extensionService.getExtensions();
      return extensions.map((ext) => {
        return new VSCExtension(
            ext,
            extensionService,
            mainThreadExtensionService,
            extensionService.extentionsActivator.get(ext.id) && extensionService.extentionsActivator.get(ext.id)!.exports,
            extensionService.extentionsActivator.get(ext.id) && extensionService.extentionsActivator.get(ext.id)!.extendExports,
          );
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
