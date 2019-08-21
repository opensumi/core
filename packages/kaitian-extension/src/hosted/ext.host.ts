import * as path from 'path';
import * as vscode from 'vscode';
import { RPCProtocol, ProxyIdentifier } from '@ali/ide-connection';
import { getLogger, Emitter } from '@ali/ide-core-common';
import { IExtension, EXTENSION_EXTEND_SERVICE_PREFIX } from '../common';
import { ExtHostStorage } from './api/vscode/api/ext.host.storage';
import { createApiFactory as createVSCodeAPIFactory } from './api/vscode/api/ext.host.api.impl';
import { MainThreadAPIIdentifier } from '../common/vscode';
import { ExtenstionContext } from './api/vscode/api/ext.host.extensions';
import { ExtensionsActivator, ActivatedExtension} from './ext.host.activator';

const logger = getLogger();

export default class ExtensionHostService {
  private extensions: IExtension[];
  private rpcProtocol: RPCProtocol;

  private vscodeAPIFactory: any;
  private vscodeExtAPIImpl: Map<string, any>;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any>;

  private extentionsActivator: ExtensionsActivator;

  private storage: ExtHostStorage;

  // TODO: 待实现 API
  // $getExtensions(): IFeatureExtension[];

  extensionsChangeEmitter: Emitter<string>;

  constructor(rpcProtocol: RPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.storage = new ExtHostStorage(rpcProtocol);
    this.vscodeAPIFactory = createVSCodeAPIFactory(
      this.rpcProtocol,
      this as any,
    );
    this.vscodeExtAPIImpl = new Map();
  }

  public async init() {
    this.extensions = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionServie).$getExtensions();

    logger.log('kaitian extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));
    this.extentionsActivator = new ExtensionsActivator();
    this.defineAPI();
  }

  public getExtensions(): IExtension[] {
    return this.extensions;
  }

  public getExtension(extensionId: string): IExtension | undefined {
    return this.extensions.find((extension) => {
      return extensionId === extension.id;
    });
  }

  private findExtension(filePath: string) {
    return this.extensions.find((extension) => filePath.startsWith(extension.path));
  }
  private defineAPI() {
    const module = require('module');
    const originalLoad = module._load;
    const findExtension = this.findExtension.bind(this);
    const vscodeExtAPIImpl = this.vscodeExtAPIImpl;
    const vscodeAPIFactory = this.vscodeAPIFactory.bind(this);

    // TODO: 注入 kaitian API
    module._load = function load(request: string, parent: any, isMain: any) {
      if (request !== 'vscode') {
        return originalLoad.apply(this, arguments);
      }

      const extension = findExtension(parent.filename);

      if (!extension) {
        return;
      }

      let vscodeAPIImpl = vscodeExtAPIImpl.get(extension.id);
      if (!vscodeAPIImpl) {
        try {
          vscodeAPIImpl = vscodeAPIFactory(extension);
        } catch (e) {
          logger.error(e);
        }
      }

      return vscodeAPIImpl;
    };
  }

  // TODO: 插件销毁流程
  private async activateExtension(id: string) {
    logger.log('kaitian exthost $activateExtension', id);
    // await this._ready

    // TODO: 处理没有 VSCode 插件的情况
    const extension: IExtension | undefined = this.extensions.find((ext) => {
      return ext.id === id;
    });
    if (!extension) {
      logger.error(`extension ${id}'s modulePath not found`);
      return;
    }
    const modulePath: string = extension.path;
    const extensionModule: any = require(modulePath);

    logger.log('kaitian exthost $activateExtension path', modulePath);
    if (extensionModule.activate) {
      // FIXME: 考虑在 Context 这里直接注入服务注册的能力
      const context = await this.loadExtensionContext(id, modulePath, this.storage);
      try {
        const exportsData = await extensionModule.activate(context) || extensionModule;
        this.extentionsActivator.set(id, new ActivatedExtension(
          false,
          null,
          extensionModule,
          exportsData,
          context.subscriptions,
        ));
      } catch (e) {
        this.extentionsActivator.set(id, new ActivatedExtension(
          true,
          e,
          extensionModule,
          undefined,
          context.subscriptions,
        ));

        logger.error(e);
      }
    }

    if (extension.extendConfig && extension.extendConfig.node && extension.extendConfig.node.main) {
      const extendModule: any = require(path.join(extension.path, extension.extendConfig.node.main));
      if (extendModule.activate) {
        try {
          const extendProxy = this.getExtendModuleProxy(extension);
          const extendModuleExportsData = await extendModule.activate(extendProxy);
          this.registerExtendModuleService(extendModuleExportsData, extension);
        } catch (e) {
          getLogger().error(e);
        }
      }
    }
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

    console.log('extension extend service', extension.id, 'service', service);
    this.rpcProtocol.set({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}`} as ProxyIdentifier<any>, service);
  }

  public async $activateExtension(id: string) {
    return this.activateExtension(id);
  }

  private async loadExtensionContext(extensionId: string, modulePath: string, storageProxy: ExtHostStorage) {
    const context = new ExtenstionContext({
      extensionId,
      extensionPath: modulePath,
      storageProxy,
    });

    return Promise.all([
      context.globalState.whenReady,
      context.workspaceState.whenReady,
    ]).then(() => {
      return Object.freeze(context as vscode.ExtensionContext);
    });
  }

}
