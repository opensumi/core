import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RPCProtocol, ProxyIdentifier } from '@ali/ide-connection';
import { getLogger, Emitter } from '@ali/ide-core-common';
import * as merge from 'deepmerge';
import { IExtension, EXTENSION_EXTEND_SERVICE_PREFIX, IExtensionHostService, IExtendProxy } from '../common';
import { ExtHostStorage } from './api/vscode/ext.host.storage';
import { createApiFactory as createVSCodeAPIFactory } from './api/vscode/ext.host.api.impl';
import { createAPIFactory as createKaiTianAPIFactory } from './api/kaitian/ext.host.api.impl';
import { MainThreadAPIIdentifier, VSCodeExtensionService } from '../common/vscode';
import { ExtenstionContext } from './api/vscode/ext.host.extensions';
import { ExtensionsActivator, ActivatedExtension} from './ext.host.activator';
import { VSCExtension } from './vscode.extension';
import { ExtensionLogger } from './extension-log';

/**
 * 在Electron中，会将kaitian中的extension-host使用webpack打成一个，所以需要其他方法来获取原始的require
 */
declare var __webpack_require__: any;
declare var __non_webpack_require__: any;

// https://github.com/webpack/webpack/issues/4175#issuecomment-342931035
export function getNodeRequire() {
  return typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
}

export default class ExtensionHostServiceImpl implements IExtensionHostService {
  private logger: ExtensionLogger;
  private extensions: IExtension[];
  private rpcProtocol: RPCProtocol;

  private vscodeAPIFactory: any;
  private vscodeExtAPIImpl: Map<string, any>;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any>;

  public extentionsActivator: ExtensionsActivator;
  public storage: ExtHostStorage;

  readonly extensionsChangeEmitter: Emitter<string> = new Emitter<string>();

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.storage = new ExtHostStorage(rpcProtocol);
    this.vscodeAPIFactory = createVSCodeAPIFactory(
      this.rpcProtocol,
      this as any,
      this.rpcProtocol.getProxy<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie),
    );
    this.kaitianAPIFactory = createKaiTianAPIFactory(
      this.rpcProtocol,
      this,
      'node',
    );

    this.vscodeExtAPIImpl = new Map();
    this.kaitianExtAPIImpl = new Map();
    this.logger = new ExtensionLogger(rpcProtocol);
  }

  public $getExtensions(): IExtension[] {
    return this.getExtensions();
  }
  public async close() {
    this.extentionsActivator.deactivated();
  }
  public async init() {
    /*
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getExtensions();

    this.logger.$debug('kaitian extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
    */
    this.extentionsActivator = new ExtensionsActivator();
    this.defineAPI();
  }

  public getExtensions(): IExtension[] {
    return this.extensions;
  }

  public async $initExtensions() {
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getExtensions();
    this.logger.debug('kaitian extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
  }

  public getExtension(extensionId: string): VSCExtension<any> | undefined {
    const extension = this.extensions.find((extension) => {
      return extensionId === extension.id;
    });
    if (extension) {
      const activateExtension = this.extentionsActivator.get(extension.id);
      return new VSCExtension(
        extension,
        this,
        this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie),
        activateExtension && activateExtension.exports,
        activateExtension && activateExtension.extendExports,
      );
    }
  }

  private findExtension(filePath: string) {
    return this.extensions.find((extension) => filePath.startsWith(fs.realpathSync(extension.path)));
  }
  private defineAPI() {
    const module = getNodeRequire()('module');
    const originalLoad = module._load;
    const findExtension = this.findExtension.bind(this);

    const vscodeExtAPIImpl = this.vscodeExtAPIImpl;
    const vscodeAPIFactory = this.vscodeAPIFactory.bind(this);

    const kaitianExtAPIImpl = this.kaitianExtAPIImpl;
    const kaitianAPIFactory = this.kaitianAPIFactory.bind(this);
    const that = this;
    module._load = function load(request: string, parent: any, isMain: any) {
      if (request !== 'vscode' && request !== 'kaitian') {
        return originalLoad.apply(this, arguments);
      }

      const extension = findExtension(parent.filename);

      if (!extension) {
        return;
      }
      if (request === 'vscode') {
        let vscodeAPIImpl = vscodeExtAPIImpl.get(extension.id);
        if (!vscodeAPIImpl) {
          try {
            vscodeAPIImpl = vscodeAPIFactory(extension);
            vscodeExtAPIImpl.set(extension.id, vscodeAPIImpl);
          } catch (e) {
            that.logger.error(e);
          }
        }

        return vscodeAPIImpl;
      } else if (request === 'kaitian') {
        let kaitianAPIImpl = kaitianExtAPIImpl.get(extension.id);
        const vscodeAPIImpl = vscodeExtAPIImpl.get(extension.id) || vscodeAPIFactory(extension);
        if (!kaitianAPIImpl) {
          try {
            kaitianAPIImpl = kaitianAPIFactory(extension);
            kaitianExtAPIImpl.set(extension.id, kaitianAPIImpl);
          } catch (e) {
            that.logger.error(e);
          }
        }

        return merge(vscodeAPIImpl, kaitianAPIImpl);
      }

    };
  }

  public getExtensionExports(extensionId: string) {
    const activateExtension = this.extentionsActivator.get(extensionId);
    if (activateExtension) {
      return activateExtension.exports;
    }
  }

  public getExtendExports(extensionId: string) {
    const activatedExtension = this.extentionsActivator.get(extensionId);
    if (activatedExtension) {
      return activatedExtension.extendExports;
    }
  }

  public isActivated(extensionId: string) {
    return this.extentionsActivator.has(extensionId);
  }

  // TODO: 插件销毁流程
  public async activateExtension(id: string) {
    this.logger.debug('kaitian exthost $activateExtension', id);
    // await this._ready

    // TODO: 处理没有 VSCode 插件的情况
    const extension: IExtension | undefined = this.extensions.find((ext) => {
      return ext.id === id;
    });

    if (!extension) {
      this.logger.error(`extension ${id}'s modulePath not found`);
      return;
    }

    if (this.extentionsActivator.get(id)) {
      this.logger.warn(`extension ${id} is already activated.`);
      return;
    }

    const modulePath: string = extension.path;
    const extensionModule: any = getNodeRequire()(modulePath);

    this.logger.debug('kaitian exthost $activateExtension path', modulePath);
    const extendProxy = this.getExtendModuleProxy(extension);

    const context = await this.loadExtensionContext(extension, modulePath, this.storage, extendProxy);

    let activationFailed = false;
    let activationFailedError = null;
    let extendModule;
    let exportsData;
    let extendExports;

    if (extensionModule.activate) {
      // FIXME: 考虑在 Context 这里直接注入服务注册的能力
      try {
        const extensionExports = await extensionModule.activate(context) || extensionModule;
        exportsData = extensionExports;

      } catch (e) {
        activationFailed = true;
        activationFailedError = e;
        this.logger.error(e);
      }
    }

    if (extension.extendConfig && extension.extendConfig.node && extension.extendConfig.node.main) {

      extendModule = getNodeRequire()(path.join(extension.path, extension.extendConfig.node.main));
      if (extendModule.activate) {
        try {
          const extendModuleExportsData = await extendModule.activate(context);
          this.registerExtendModuleService(extendModuleExportsData, extension);
          extendExports = extendModuleExportsData;
        } catch (e) {
          console.log('activateExtension extension.extendConfig error ');
          console.log(e);
          getLogger().error(e);
        }
      }
    }
    this.extentionsActivator.set(id, new ActivatedExtension(
      activationFailed,
      activationFailedError,
      extensionModule,
      exportsData,
      context.subscriptions,
      undefined,
      extendExports,
      extendModule,
    ));
  }

  private getExtendModuleProxy(extension: IExtension) {
    const extendProxy = {};
    if (
      extension.extendConfig &&
      extension.extendConfig.browser &&
      extension.extendConfig.browser.componentId
    ) {
      const componentIdArr = extension.extendConfig.browser.componentId;
      for (let i = 0, len = componentIdArr.length; i < len; i++) {
        const id = componentIdArr[i];
        extendProxy[id] = this.rpcProtocol.getProxy({
          serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}:${id}`,
        } as ProxyIdentifier<any>);

        extendProxy[id] = new Proxy(extendProxy[id], {
          get: (obj, prop) => {
            if (typeof prop === 'symbol') {
              return obj[prop];
            }

            return obj[`$${prop}`];
          },
        });
      }
    }

    return extendProxy;
  }

  private registerExtendModuleService(exportsData, extension: IExtension) {
    const service = {};
    for (const key in exportsData) {
      if (exportsData.hasOwnProperty(key)) {
        if (typeof exportsData[key] === 'function') {
          service[`$${key}`] = exportsData[key];
        }
      }
    }

    this.logger.debug('extension extend service', extension.id, 'service', service);
    this.rpcProtocol.set({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}`} as ProxyIdentifier<any>, service);
  }

  public async $activateExtension(id: string) {
    return this.activateExtension(id);
  }

  private async loadExtensionContext(extension: IExtension, modulePath: string, storageProxy: ExtHostStorage, extendProxy: IExtendProxy) {

    const extensionId = extension.id;
    const registerExtendFn = (exportsData) => {
      console.log(exportsData);
      return this.registerExtendModuleService(exportsData, extension);
    };

    const context = new ExtenstionContext({
      extensionId,
      extensionPath: modulePath,
      storageProxy,
      extendProxy,
      registerExtendModuleService: registerExtendFn,
    });

    return Promise.all([
      context.globalState.whenReady,
      context.workspaceState.whenReady,
    ]).then(() => {
      return Object.freeze(context as vscode.ExtensionContext);
    });
  }

}
