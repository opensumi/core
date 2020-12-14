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
  resolveStaticResource(uri: URI): Promise<URI>;
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

  /**
   * @param relativePath 相对路径
   * @return 返回经过 static 转换后的 href
   * asAbsolutePath 是同步的，因此这里额外加个异步 api
   */
  asHref(relativePath: string): Promise<string>;
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

  private _resolveStaticResource: (uri: URI) => Promise<URI>;

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
    this._resolveStaticResource = options.resolveStaticResource;
  }

  get globalStoragePath() {
    return this._storage.storagePath.globalStoragePath;
  }

  // CARE: 保持和 node 的接口一致
  // 这里的值对于前端获取意义不大，之前的实现有问题，不应该耦合 /assets?path= 的路径，实际集成测不一定是这种形式地址
  // 如果需要 href，推荐使用 asHref
  get extensionPath() {
    return this._extensionPath;
  }

  asAbsolutePath(relativePath: string, scheme: 'http' | 'file' = 'http'): string {
    const uriPath = path.join(this._extensionPath, relativePath);
    if (scheme === 'file' || new URI(this._extensionPath).scheme) {
      // 在纯前端场景下，传入的extensionPath自带scheme kt-ext
      return uriPath;
    }
    const assetsUri = new URI(this.staticServicePath);
    return assetsUri.withPath(`assets${decodeURIComponent(uriPath)}`).toString();
  }

  async asHref(relativePath: string) {
    let extensionUri = new URI(this._extensionPath);
    if (!extensionUri.scheme) {
      extensionUri = URI.file(this._extensionPath);
    }
    relativePath = relativePath.replace(/^\.\//, '');
    const assetsUri = extensionUri.resolve(relativePath);
    // CARE：这里防止 ?a=b 的 = 被编码，但是对于文件路径含有保留字符也可能会导致问题，框架中的 resolveStaticResource 这样实现的，看起来可能出问题概率不大
    return (await this._resolveStaticResource(assetsUri)).toString(true);
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
