import type * as vscode from 'vscode';
import * as path from 'path';
import { IExtendProxy, IExtensionHost, IExtensionProps } from '../../../common';
import { ExtensionMemento, ExtHostStorage } from './ext.host.storage';
import { Uri } from '@ali/ide-core-common/lib/uri';
import { ExtensionMode } from '../../../common/vscode/ext-types';
import { IExtHostTerminal } from '../../../common/vscode';

export interface IKTContextOptions {
  extension: IExtensionProps;
  extensionId: string;
  extensionPath: string;
  extensionLocation: Uri;
  storageProxy: ExtHostStorage;
  extendProxy?: IExtendProxy;
  isDevelopment?: boolean;
  registerExtendModuleService?: (exportsData: any) => void;
  exthostTerminal?: IExtHostTerminal;
}

export interface IKTExtensionContext {
  readonly componentProxy: IExtendProxy | undefined;
  readonly registerExtendModuleService: ((moduleExports: any) => void) | undefined;
  readonly subscriptions: { dispose(): any }[];
  readonly extensionPath: string;
  /**
   * Get the absolute path of a resource contained in the extension.
   *
   * @param relativePath A relative path to a resource contained in the extension.
   * @return The absolute path of the resource.
   */
  asAbsolutePath(relativePath: string): string;
}

export class ExtensionContext implements vscode.ExtensionContext, IKTExtensionContext {

  readonly subscriptions: { dispose(): any }[] = [];

  readonly _extensionLocation: Uri;

  readonly _isDevelopment: boolean;

  readonly workspaceState: ExtensionMemento;

  readonly globalState: ExtensionMemento;

  private _storage: ExtHostStorage;

  private exthostTerminalService: IExtHostTerminal | undefined;

  private extension: IExtensionProps;

  public componentProxy: IExtendProxy | undefined;

  public registerExtendModuleService: ((exportsData: any) => void) | undefined;

  constructor(options: IKTContextOptions) {
    const {
      extension,
      extensionId,
      storageProxy,
      extensionLocation,
      isDevelopment,
    } = options;
    this._storage = storageProxy;
    this.extension = extension;
    this._extensionLocation = extensionLocation;
    this._isDevelopment = !!isDevelopment;
    this.workspaceState = new ExtensionMemento(extensionId, false, storageProxy);
    this.globalState = new ExtensionMemento(extensionId, true, storageProxy);
    this.exthostTerminalService = options.exthostTerminal;
    this.componentProxy = options.extendProxy;
    this.registerExtendModuleService = options.registerExtendModuleService;
  }

  asAbsolutePath(relativePath: string): string {
    return path.join(this._extensionLocation.fsPath, relativePath);
  }

  get extensionPath() {
    return this._extensionLocation.fsPath;
  }

  get extensionUri() {
    return this._extensionLocation;
  }

  get storagePath() {
    return this._storage.storagePath.storageUri?.path.toString();
  }

  get logPath() {
    return this._storage.storagePath.logUri.path.toString();
  }

  get storageUri() {
    return this._storage.storagePath.storageUri;
  }

  get logUri() {
    return this._storage.storagePath.logUri;
  }

  get globalStoragePath() {
    return this._storage.storagePath.globalStorageUri.path.toString();
  }

  get globalStorageUri() {
    return this._storage.storagePath.globalStorageUri;
  }

  get extensionMode() {
    return this._isDevelopment ? ExtensionMode.Development : ExtensionMode.Production;
  }

  get environmentVariableCollection() {
    return this.exthostTerminalService?.getEnviromentVariableCollection(this.extension);
  }
}

export function createExtensionsApiFactory<T extends IExtensionHost>(
  extensionService: T,
) {

  return {
    all: (() => {
      return extensionService.getExtensions();
    })(),
    get onDidChange() {
      return extensionService.extensionsChangeEmitter.event;
    },
    getExtension(extensionId: string) {
      return extensionService.getExtension(extensionId);
    },
  };
}
