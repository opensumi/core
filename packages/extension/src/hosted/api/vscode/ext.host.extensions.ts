import path from 'path';

import type vscode from 'vscode';

import { Uri } from '@opensumi/ide-core-common/lib/uri';

import { IExtendProxy, IExtensionHost, IExtensionProps } from '../../../common';
import { IExtHostTerminal } from '../../../common/vscode';
import { ExtensionMode } from '../../../common/vscode/ext-types';
import { KTExtension, KTWorkerExtension } from '../../vscode.extension';

import { ExtensionSecrets, ExtHostSecret } from './ext.host.secrets';
import { ExtensionGlobalMemento, ExtensionMemento, ExtHostStorage } from './ext.host.storage';

export interface IKTContextOptions {
  extensionId: string;
  extensionPath: string;
  extensionLocation: Uri;
  extensionDescription: IExtensionProps;
  storageProxy: ExtHostStorage;
  secretProxy: ExtHostSecret;
  extendProxy?: IExtendProxy;
  isDevelopment?: boolean;
  registerExtendModuleService?: (exportsData: any) => void;
  exthostTerminal?: IExtHostTerminal;
  createExtension: (extensionDescription: IExtensionProps) => KTExtension<unknown> | KTWorkerExtension<unknown>;
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

  readonly globalState: ExtensionGlobalMemento;

  readonly secrets: ExtensionSecrets;

  private createExtension: IKTContextOptions['createExtension'];

  private _storage: ExtHostStorage;

  private exthostTerminalService: IExtHostTerminal | undefined;

  private extensionDescription: IExtensionProps;

  public componentProxy: IExtendProxy | undefined;

  public registerExtendModuleService: ((exportsData: any) => void) | undefined;

  constructor(options: IKTContextOptions) {
    const {
      extensionId,
      storageProxy,
      secretProxy,
      createExtension,
      isDevelopment,
      extensionLocation,
      extensionDescription,
    } = options;

    this._storage = storageProxy;
    this.createExtension = createExtension;
    this.extensionDescription = extensionDescription;
    this._extensionLocation = extensionLocation;
    this._isDevelopment = !!isDevelopment;
    this.workspaceState = new ExtensionMemento(extensionId, false, storageProxy);
    this.globalState = new ExtensionGlobalMemento(extensionId, true, storageProxy);
    this.secrets = new ExtensionSecrets(extensionDescription, secretProxy);
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
    return this._storage.storagePath.storageUri?.fsPath.toString();
  }

  get logPath() {
    return this._storage.storagePath.logUri.fsPath.toString();
  }

  get storageUri() {
    return this._storage.storagePath.storageUri;
  }

  get logUri() {
    return this._storage.storagePath.logUri;
  }

  get globalStoragePath() {
    return this._storage.storagePath.globalStorageUri.fsPath.toString();
  }

  get globalStorageUri() {
    return this._storage.storagePath.globalStorageUri;
  }

  get extensionMode() {
    return this._isDevelopment ? ExtensionMode.Development : ExtensionMode.Production;
  }

  get environmentVariableCollection() {
    return this.exthostTerminalService?.getEnviromentVariableCollection(this.extensionDescription)!;
  }

  get extension() {
    return this.createExtension(this.extensionDescription);
  }
}

export function createExtensionsApiFactory<T extends IExtensionHost>(extensionService: T) {
  return {
    all: (() => extensionService.getExtensions())(),
    get onDidChange() {
      return extensionService.extensionsChangeEmitter.event;
    },
    getExtension(extensionId: string) {
      return extensionService.getExtension(extensionId);
    },
  };
}
