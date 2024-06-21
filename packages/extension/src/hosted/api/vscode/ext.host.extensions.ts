import { IDisposable, Uri } from '@opensumi/ide-core-common';
import { join } from '@opensumi/ide-utils/lib/path';

import { IExtendProxy, IExtensionHost, IExtensionProps } from '../../../common';
import { IExtHostStorage, IExtHostTerminal } from '../../../common/vscode';
import { ExtensionMode } from '../../../common/vscode/ext-types';
import { KTExtension, KTWorkerExtension } from '../../vscode.extension';

import { ExtHostSecret, ExtensionSecrets } from './ext.host.secrets';
import { ExtensionGlobalMemento, ExtensionMemento } from './ext.host.storage';

import type vscode from 'vscode';

export interface IKTContextOptions {
  extensionId: string;
  extensionPath: string;
  extensionLocation: Uri;
  extensionDescription: IExtensionProps;
  storageProxy: IExtHostStorage;
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
  readonly subscriptions: IDisposable[] = [];

  readonly _extensionLocation: Uri;

  readonly _isDevelopment: boolean;

  readonly workspaceState: ExtensionMemento;

  readonly globalState: ExtensionGlobalMemento;

  readonly secrets: ExtensionSecrets;

  private createExtension: IKTContextOptions['createExtension'];

  private _storage: IExtHostStorage;

  private exthostTerminalService: IExtHostTerminal | undefined;

  private extensionDescription: IExtensionProps;

  public componentProxy: IExtendProxy | undefined;

  public registerExtendModuleService: ((exportsData: any) => void) | undefined;

  extensionId: string;

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

    this.extensionId = extensionId;

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
    return join(this._extensionLocation.fsPath, relativePath);
  }

  get extensionUri() {
    return this._extensionLocation;
  }

  get extensionPath() {
    return this._extensionLocation.fsPath;
  }

  get storageUri() {
    return this._storage.getExtensionStorageUri(this.extensionId);
  }

  get storagePath() {
    return this.storageUri?.fsPath.toString();
  }

  get logUri() {
    return this._storage.getExtensionLogUri(this.extensionId);
  }

  get logPath() {
    return this.logUri.fsPath.toString();
  }

  get globalStorageUri() {
    return this._storage.getExtensionGlobalStorageUri(this.extensionId);
  }

  get globalStoragePath() {
    return this.globalStorageUri.fsPath.toString();
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
    // TODO: VS Code 目前支持多个 worker 插件进程，该 API 为获取当前插件进程可以访问的进程
    // anycode 最新版插件依赖改 API，先临时实现
    allAcrossExtensionHosts: (() => extensionService.getExtensions())(),
    get onDidChange() {
      return extensionService.extensionsChangeEmitter.event;
    },
    getExtension(extensionId: string) {
      return extensionService.getExtension(extensionId);
    },
  };
}
