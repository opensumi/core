import type * as vscode from 'vscode';
import * as path from 'path';
import { IExtendProxy, IExtensionHost } from '../../../common';
import { ExtensionMemento, ExtHostStorage } from './ext.host.storage';
import { URI } from '@ali/ide-core-common/lib/uri';

export interface IKTContextOptions {
  extensionId: string;
  extensionPath: string;
  storageProxy: ExtHostStorage;
  extendProxy?: IExtendProxy;
  registerExtendModuleService?: (exportsData: any) => void;
}

export interface IKTWorkerExtensionContextOptions extends IKTContextOptions {
  staticServicePath: string;
}

export interface IKTExtensionContext {
  readonly componentProxy: IExtendProxy | undefined;
  readonly registerExtendModuleService: ((moduleExports: any) => void) | undefined;
}

export interface IKTWorkerExtensionContext extends IKTExtensionContext {
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

export class KTWorkerExtensionContext implements IKTWorkerExtensionContext {
  readonly subscriptions: { dispose(): any; }[] = [];
  private _extensionPath: string;
  readonly staticServicePath: string;

  readonly workspaceState: ExtensionMemento;

  readonly globalState: ExtensionMemento;

  public componentProxy: IExtendProxy | undefined;

  public registerExtendModuleService: ((moduleExports: any) => void) | undefined;

  private _storage: ExtHostStorage;

  constructor(
    options: IKTWorkerExtensionContextOptions,
  ) {
    const { extensionPath, staticServicePath, extendProxy, registerExtendModuleService, storageProxy, extensionId } = options;
    this._extensionPath = extensionPath;
    this._storage = storageProxy;
    this.staticServicePath = staticServicePath;
    this.componentProxy = extendProxy;
    this.workspaceState = new ExtensionMemento(extensionId, false, storageProxy);
    this.globalState = new ExtensionMemento(extensionId, true, storageProxy);
    this.registerExtendModuleService = registerExtendModuleService;
  }

  get globalStoragePath() {
    return this._storage.storagePath.globalStoragePath;
  }

  get extensionPath() {
    const assetsUri = new URI(this.staticServicePath);
    const extensionAssetPath = assetsUri.withPath('assets').withQuery(URI.stringifyQuery({
      path: this._extensionPath,
    })).toString();
    return extensionAssetPath;
  }

  asAbsolutePath(relativePath: string, scheme: 'http' | 'file' = 'http'): string {
    if (scheme === 'file' || new URI(this._extensionPath).scheme) {
      // 在纯前端场景下，传入的extensionPath自带scheme kt-ext
      return path.join(this._extensionPath, relativePath);
    }
    const assetsUri = new URI(this.staticServicePath);
    const assetSPath = assetsUri.withPath('assets').withQuery(URI.stringifyQuery({
      path: path.join(this._extensionPath, relativePath),
    })).toString();
    return decodeURIComponent(assetSPath);
  }
}

export class ExtensionContext implements vscode.ExtensionContext, IKTExtensionContext {

  readonly subscriptions: { dispose(): any }[] = [];

  readonly extensionPath: string;

  readonly workspaceState: ExtensionMemento;

  readonly globalState: ExtensionMemento;

  private _storage: ExtHostStorage;

  public componentProxy: IExtendProxy | undefined;

  public registerExtendModuleService: ((exportsData: any) => void) | undefined;

  constructor(options: IKTContextOptions) {
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
