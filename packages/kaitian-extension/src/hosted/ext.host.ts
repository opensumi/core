import * as path from 'path';
import type * as vscode from 'vscode';

import { Injector } from '@ali/common-di';
import { RPCProtocol, ProxyIdentifier } from '@ali/ide-connection';
import { getDebugLogger, Emitter, IReporterService, REPORT_HOST, REPORT_NAME, IExtensionProps, Uri, timeout, ReporterService, IReporter } from '@ali/ide-core-common';
import { EXTENSION_EXTEND_SERVICE_PREFIX, IExtensionHostService, IExtendProxy, getExtensionId } from '../common';
import { ExtHostStorage } from './api/vscode/ext.host.storage';
import { createApiFactory as createVSCodeAPIFactory } from './api/vscode/ext.host.api.impl';
import { createAPIFactory as createKaitianAPIFactory } from './api/kaitian/ext.host.api.impl';
import { MainThreadAPIIdentifier, VSCodeExtensionService, IExtensionDescription, ExtensionIdentifier } from '../common/vscode';
import { ExtensionContext } from './api/vscode/ext.host.extensions';
import { KTExtension } from './vscode.extension';
import { AppConfig } from '@ali/ide-core-node';
import { ActivatedExtension, ExtensionsActivator, ActivatedExtensionJSON } from '../common/activator';

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
  private logger: any; // ExtensionLogger;
  private extensions: IExtensionDescription[];
  private rpcProtocol: RPCProtocol;

  private vscodeAPIFactory: any;
  private vscodeExtAPIImpl: Map<string, any>;

  private kaitianAPIFactory: any;
  private kaitianExtAPIImpl: Map<string, any>;

  public extensionsActivator: ExtensionsActivator;
  public storage: ExtHostStorage;

  readonly extensionsChangeEmitter: Emitter<void> = new Emitter<void>();

  private reporterService: IReporterService;

  constructor(rpcProtocol: RPCProtocol, logger, private injector: Injector) {
    this.rpcProtocol = rpcProtocol;
    this.storage = new ExtHostStorage(rpcProtocol);
    const reporter = injector.get(IReporter);
    this.vscodeAPIFactory = createVSCodeAPIFactory(
      this.rpcProtocol,
      this as any,
      this.rpcProtocol.getProxy<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService),
      this.injector.get(AppConfig),
    );
    this.kaitianAPIFactory = createKaitianAPIFactory(
      this.rpcProtocol,
      this,
      'node',
      reporter,
    );

    this.vscodeExtAPIImpl = new Map();
    this.kaitianExtAPIImpl = new Map();
    this.logger = logger; // new ExtensionLogger(rpcProtocol);
    this.reporterService = new ReporterService(reporter, {
      host: REPORT_HOST.EXTENSION,
    });

    Error.stackTraceLimit = 100;
  }

  public async $getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    return this.extensionsActivator.all().map((e) => e.toJSON());
  }

  public $getExtensions(): IExtensionDescription[] {
    return this.extensions;
  }

  public async close() {
    await Promise.race([timeout(4000), this.extensionsActivator.deactivate]);
  }

  public async init() {
    this.extensionsActivator = new ExtensionsActivator(this.logger);
    this.defineAPI();
  }

  public getExtensions(): KTExtension[] {
    return this.extensions.map((ext) => {
      return new KTExtension(
        ext,
        this as unknown as IExtensionHostService,
        this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionService),
        this.getExtensionExports(ext.id),
        this.getExtendExports(ext.id),
      );
    });
  }

  private _extHostErrorStackTraceExtended = false;
  private extendExtHostErrorStackTrace() {
    if (this._extHostErrorStackTraceExtended) {
      return;
    }

    this._extHostErrorStackTraceExtended = true;
    Error.stackTraceLimit = 100;

    Error.prepareStackTrace = (error: Error, stackTrace: any[]) => {
      let extension: IExtensionDescription | undefined;
      let stackTraceMessage = `Error: ${error.message}`;
      let fileName: string;
      for (const call of stackTrace) {
        stackTraceMessage += `\n\tat ${call.toString()}`;
        fileName = call.getFileName();
        if (!extension && fileName) {
          //
          // 遍历异常堆栈中的 filename，尝试查找抛出异常的插件
          //
          extension = this.findExtension(fileName);
        }
      }

      if (extension) {
        this.reportRuntimeError(error, extension, stackTraceMessage);
      }

      const traceMassage = `${error.name || 'Error'}: ${error.message || ''}${stackTraceMessage}`;
      return traceMassage;
    };

  }

  public async $updateExtHostData() {
    const extensions: IExtensionProps[] = await this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionService).$getExtensions();
    // node 层 extensionLocation 不使用 static 直接使用 file
    // node 层 extension 实例和 vscode 保持一致，并继承 IExtensionProps
    this.extensions = extensions.map((item) => ({
      ...item,
      isUnderDevelopment: !!item.isDevelopment,
      publisher: item.packageJSON?.publisher,
      version: item.packageJSON?.version,
      engines: item.packageJSON?.engines,
      identifier: new ExtensionIdentifier(item.id),
      uuid: item.packageJSON?.__metadata?.id,
      extensionLocation: Uri.file(item.path),
    }));
    this.logger.debug('kaitian extensions', this.extensions.map((extension) => {
      return extension.packageJSON.name;
    }));

    this.extendExtHostErrorStackTrace();
  }

  public async $fireChangeEvent() {
    this.extensionsChangeEmitter.fire();
  }

  public getExtension(extensionId: string): KTExtension<any> | undefined {
    const extension = this.extensions.find((extension) => {
      return getExtensionId(extensionId) === getExtensionId(extension.id);
    });
    if (extension) {
      const activateExtension = this.extensionsActivator.get(extension.id);
      return new KTExtension(
        extension,
        this as unknown as IExtensionHostService,
        this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionService),
        activateExtension && activateExtension.exports,
        activateExtension && activateExtension.extendExports,
      );
    }
  }

  private findExtension(filePath: string) {
    return this.extensions.find((extension) => filePath.startsWith(extension.realPath));
  }

  private lookup(extensionModule: NodeJS.Module, depth: number): IExtensionDescription | undefined {
    if (depth >= 3) {
      return undefined;
    }

    const extension = this.findExtension(extensionModule.filename);
    if (extension) {
      return extension;
    }

    if (extensionModule.parent) {
      return this.lookup(extensionModule.parent, depth += 1);
    }

    return undefined;
  }

  private defineAPI() {
    const module = getNodeRequire()('module');
    const originalLoad = module._load;

    const vscodeExtAPIImpl = this.vscodeExtAPIImpl;
    const vscodeAPIFactory = this.vscodeAPIFactory.bind(this);

    const kaitianExtAPIImpl = this.kaitianExtAPIImpl;
    const kaitianAPIFactory = this.kaitianAPIFactory.bind(this);
    const that = this;
    module._load = function load(request: string, parent: any, isMain: any) {
      if (request !== 'vscode' && request !== 'kaitian') {
        return originalLoad.apply(this, arguments);
      }

      //
      // 可能存在开发插件时通过 npm link 的方式安装的依赖
      // 只通过 parent.filename 查找插件无法兼容这种情况
      // 因为 parent.filename 拿到的路径并不在同一个目录下
      // 往上递归遍历依赖的模块是否在插件目录下
      // 最多只查找 3 层，因为不太可能存在更长的依赖关系
      //
      const extension = that.lookup(parent, 0);
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

        return  { ...vscodeAPIImpl, ...kaitianAPIImpl };
      }

    };
  }

  public getExtensionExports(extensionId: string) {
    const activateExtension = this.extensionsActivator.get(extensionId);
    if (activateExtension) {
      return activateExtension.exports;
    }
  }

  public getExtendExports(extensionId: string) {
    const activatedExtension = this.extensionsActivator.get(extensionId);
    if (activatedExtension) {
      return activatedExtension.extendExports;
    }
  }

  private containsKaitianContributes(extension: IExtensionDescription): boolean {
    if (extension.packageJSON.kaitianContributes) {
      return true;
    }
    return false;
  }

  public isActivated(extensionId: string) {
    return this.extensionsActivator.has(extensionId);
  }

  private reportRuntimeError(err: Error, extension: IExtensionDescription, stackTraceMessage: string) {
    /**
     * 可能存在一些第三方库会主动抛出空的 Error ，例如 https://github.com/BrunoCesarAngst/daoo/blob/32e85c7799f9929685be299f07011fe4afa72f9d/aula13/node_modules/bluebird/js/release/async.js#L3
     * 这会导致上报的异常信息干扰非常大，无法正常基于堆栈排查问题
     * 所以这里过滤掉 message 为空的 Error
     */
    if (err && err.message) {
      this.reporterService.point(REPORT_NAME.RUNTIME_ERROR_EXTENSION, extension.id, {
        stackTraceMessage,
        error: err.message,
        version: extension.packageJSON?.version,
      });

      this.logger.error(err.message);
    }
  }

  public async activateExtension(id: string) {
    this.logger.debug('kaitian exthost $activateExtension', id);

    const extension: IExtensionDescription | undefined = this.extensions.find((ext) => {
      return ext.id === id;
    });

    if (!extension) {
      this.logger.error(`extension ${id} not found`);
      return;
    }

    if (this.extensionsActivator.get(id)) {
      this.logger.warn(`extension ${id} is already activated.`);
      return;
    }

    const isKaitianContributes = this.containsKaitianContributes(extension);

    const modulePath: string = extension.path;
    this.logger.debug(`${extension.name} - ${modulePath}`);

    this.logger.debug('kaitian exthost $activateExtension path', modulePath);
    const extendProxy = this.getExtendModuleProxy(extension, isKaitianContributes);

    const context = await this.loadExtensionContext(extension, modulePath, this.storage, extendProxy);

    let activationFailed = false;
    let activationFailedError: Error | null = null;
    let extendModule;
    let exportsData;
    let extendExports;
    let extensionModule: any = {};

    if (extension.packageJSON.main) {
      const reportTimer = this.reporterService.time(REPORT_NAME.LOAD_EXTENSION_MAIN);
      try {
        extensionModule = getNodeRequire()(modulePath);
        reportTimer.timeEnd(extension.id);
      } catch (err) {
        activationFailed = true;
        activationFailedError = err;
        this.logger.error(`[Extension-Host][Activate Exception] ${extension.id}: `, err);
      }

      if (extensionModule.activate) {
        this.logger.debug(`try activate ${extension.name}`);
        // FIXME: 考虑在 Context 这里直接注入服务注册的能力
        try {
          const reportTimer = this.reporterService.time(REPORT_NAME.ACTIVE_EXTENSION);
          const extensionExports = await extensionModule.activate(context) || extensionModule;
          reportTimer.timeEnd(extension.id, {
            version: extension.packageJSON.version,
          });
          exportsData = extensionExports;

        } catch (e) {
          activationFailed = true;
          activationFailedError = e;
          this.logger.error(`[Extension-Host][Activate Exception] ${extension.id}: `, e);
        }
      }
    }

    if (extension.packageJSON.kaitianContributes && extension.packageJSON.kaitianContributes.nodeMain) {
      try {
        const reportTimer = this.reporterService.time(REPORT_NAME.ACTIVE_EXTENSION);
        extendModule = getNodeRequire()(path.join(extension.path, extension.packageJSON.kaitianContributes.nodeMain));
        reportTimer.timeEnd(extension.id, {
          version: extension.packageJSON.version,
        });
      } catch (err) {
        activationFailed = true;
        activationFailedError = err;
        this.reportRuntimeError(err, extension, err.stack);
        this.logger.error(`[Extension-Host][Activate Exception] ${extension.id}: `, err);
      }
    } else if (extension.extendConfig && extension.extendConfig.node && extension.extendConfig.node.main) {
      extendModule = getNodeRequire()(path.join(extension.path, extension.extendConfig.node.main));
      if (!extendModule) {
        this.logger.warn(`Can not find extendModule ${extension.id}`);
      }
    }

    if (extendModule && extendModule.activate) {
      try {
        const extendModuleExportsData = await extendModule.activate(context);
        extendExports = extendModuleExportsData;
      } catch (e) {
        activationFailed = true;
        activationFailedError = e;
        this.reportRuntimeError(e, extension, e.stack);
        this.logger.log('activateExtension extension.extendConfig error ');
        this.logger.log(e);
        getDebugLogger().error(`${extension.id}`);
        getDebugLogger().error(e);
      }
    }
    this.extensionsActivator.set(id, new ActivatedExtension(
      id,
      extension.packageJSON.displayName || extension.name,
      extension.packageJSON.description || '',
      'node',
      activationFailed,
      activationFailedError,
      extensionModule,
      exportsData,
      context.subscriptions,
      undefined,
      extendExports,
      extendModule,
    ));
    // 如果有异常，则向上抛出
    if (activationFailedError) {
      throw activationFailedError;
    }
  }

  private getExtensionViewModuleProxy(extension: IExtensionDescription, viewsProxies: string[]) {
    return viewsProxies.reduce((proxies, viewId) => {
      proxies[viewId] = this.rpcProtocol.getProxy({
        serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}:${viewId}`,
      } as ProxyIdentifier<any>);

      proxies[viewId] = new Proxy(proxies[viewId], {
        get: (obj, prop) => {
          if (typeof prop === 'symbol') {
            return obj[prop];
          }

          return obj[`$${prop}`];
        },
      });
      return proxies;
    }, {});
  }

  private getExtendModuleProxy(extension: IExtensionDescription, isKaitianContributes: boolean) {
    /**
     * @example
     * "kaitianContributes": {
     *  "viewsProxies": ["ViewComponentID"],
     * }
     */
    if (isKaitianContributes &&
      extension.packageJSON.kaitianContributes &&
      extension.packageJSON.kaitianContributes.viewsProxies
    ) {
      return this.getExtensionViewModuleProxy(extension, extension.packageJSON.kaitianContributes.viewsProxies);
    } else if (
      extension.extendConfig &&
      extension.extendConfig.browser &&
      extension.extendConfig.browser.componentId
    ) {
      return this.getExtensionViewModuleProxy(extension, extension.extendConfig.browser.componentId);
    } else {
      return {};
    }
  }

  private registerExtendModuleService(exportsData, extension: IExtensionDescription) {
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

  private async loadExtensionContext(extension: IExtensionDescription, modulePath: string, storageProxy: ExtHostStorage, extendProxy: IExtendProxy) {

    const extensionId = extension.id;
    const registerExtendFn = (exportsData) => {
      return this.registerExtendModuleService(exportsData, extension);
    };

    const context = new ExtensionContext({
      extensionId,
      extensionPath: modulePath,
      extensionLocation: extension.extensionLocation,
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
