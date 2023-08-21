import path from 'path';

import { Injector } from '@opensumi/di';
import { RPCProtocol, ProxyIdentifier } from '@opensumi/ide-connection';
import {
  Emitter,
  IReporterService,
  REPORT_HOST,
  REPORT_NAME,
  IExtensionProps,
  Uri,
  timeout,
  ReporterService,
  IReporter,
  IExtensionLogger,
  arrays,
} from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node/lib/types';

import { EXTENSION_EXTEND_SERVICE_PREFIX, IExtensionHostService, IExtendProxy, getExtensionId } from '../common';
import { ActivatedExtension, ExtensionsActivator, ActivatedExtensionJSON } from '../common/activator';
import {
  ExtHostAPIIdentifier,
  MainThreadAPIIdentifier,
  IExtensionDescription,
  ExtensionIdentifier,
  IExtHostLocalization,
} from '../common/vscode';

import { createAPIFactory as createSumiAPIFactory } from './api/sumi/ext.host.api.impl';
import { createAPIFactory as createTelemetryAPIFactory } from './api/telemetry/ext.host.api.impl';
import { createApiFactory as createVSCodeAPIFactory } from './api/vscode/ext.host.api.impl';
import { ExtensionContext } from './api/vscode/ext.host.extensions';
import { ExtHostLocalization } from './api/vscode/ext.host.localization';
import { ExtHostSecret } from './api/vscode/ext.host.secrets';
import { ExtHostStorage } from './api/vscode/ext.host.storage';
import { KTExtension } from './vscode.extension';

const { enumValueToArray } = arrays;

/**
 * 对 extension-host 使用 webpack bundle 后，require 方法会被覆盖为 webpack 内部的 require
 * 这里是一个 webpack 提供的 workaround，用于获取原始的 require
 */
declare let __webpack_require__: any;
declare let __non_webpack_require__: any;

// https://github.com/webpack/webpack/issues/4175#issuecomment-342931035
export function getNodeRequire() {
  return typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
}

enum EInternalModule {
  VSCODE = 'vscode',
  KAITIAN = 'kaitian',
  SUMI = 'sumi',
  TELEMETRY = 'vscode-extension-telemetry-wrapper',
}

const __interceptModule = enumValueToArray(EInternalModule);

abstract class ApiImplFactory {
  private apiFactory: any;
  private extAPIImpl: Map<string, any>;

  constructor(readonly rpcProtocol: RPCProtocol, readonly extHost: IExtensionHostService, readonly injector: Injector) {
    this.apiFactory = this.createAPIFactory(rpcProtocol, extHost, injector);
    this.extAPIImpl = new Map();
  }

  abstract createAPIFactory(rpcProtocol: RPCProtocol, extHost: IExtensionHostService, injector: Injector): any;

  public load(extension: IExtensionDescription | undefined, addonImpl?: any) {
    if (!extension) {
      return;
    }

    let apiImpl = this.extAPIImpl.get(extension.id);
    if (!apiImpl) {
      try {
        apiImpl = this.apiFactory(extension);
        this.extAPIImpl.set(extension.id, apiImpl);
      } catch (e) {}
    }

    if (addonImpl) {
      return {
        ...addonImpl,
        ...apiImpl,
      };
    }
    return apiImpl;
  }
}

class VSCodeAPIImpl extends ApiImplFactory {
  override createAPIFactory(rpcProtocol: RPCProtocol, extHost: IExtensionHostService, injector: Injector) {
    return createVSCodeAPIFactory(rpcProtocol, extHost, injector.get(AppConfig));
  }
}

class OpenSumiAPIImpl extends ApiImplFactory {
  override createAPIFactory(rpcProtocol: RPCProtocol, extHost: IExtensionHostService, injector: Injector) {
    return createSumiAPIFactory(rpcProtocol, extHost, 'node', injector.get(IReporter));
  }
}

class TelemetryAPIImpl extends ApiImplFactory {
  override createAPIFactory(rpcProtocol: RPCProtocol, extHost: IExtensionHostService) {
    return createTelemetryAPIFactory(rpcProtocol, extHost, 'node');
  }
}

export default class ExtensionHostServiceImpl implements IExtensionHostService {
  private extensions: IExtensionDescription[];
  private rpcProtocol: RPCProtocol;

  public extensionsActivator: ExtensionsActivator;
  public storage: ExtHostStorage;
  public secret: ExtHostSecret;
  public localization: ExtHostLocalization;

  readonly extensionsChangeEmitter: Emitter<void> = new Emitter<void>();

  private vscodeAPIImpl: VSCodeAPIImpl;
  private openSumiAPIImpl: OpenSumiAPIImpl;
  private telemetryAPIImpl: TelemetryAPIImpl;

  private reporterService: IReporterService;

  private extensionErrors = new WeakMap<Error, IExtensionDescription | undefined>();

  constructor(rpcProtocol: RPCProtocol, public logger: IExtensionLogger, injector: Injector) {
    this.rpcProtocol = rpcProtocol;
    this.storage = new ExtHostStorage(rpcProtocol);
    this.secret = new ExtHostSecret(rpcProtocol);
    const reporter = injector.get(IReporter);

    this.vscodeAPIImpl = new VSCodeAPIImpl(rpcProtocol, this, injector);
    this.openSumiAPIImpl = new OpenSumiAPIImpl(rpcProtocol, this, injector);
    this.telemetryAPIImpl = new TelemetryAPIImpl(rpcProtocol, this, injector);

    this.localization = rpcProtocol.get<IExtHostLocalization>(ExtHostAPIIdentifier.ExtHostLocalization);
    this.reporterService = new ReporterService(reporter, {
      host: REPORT_HOST.EXTENSION,
    });

    Error.stackTraceLimit = 100;
  }

  /**
   * 收集插件未捕获异常
   * @param error
   */
  reportUnexpectedError(error: Error): void {
    // 在此先访问一下 stack 触发 Error.prepareStackTrace 分析的插件异常信息
    const stackTraceMassage = error.stack;
    const extension = this.extensionErrors.get(error);
    if (extension && stackTraceMassage) {
      this.reportRuntimeError(error, extension, stackTraceMassage);
    }
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
    return this.extensions.map(
      (ext) =>
        new KTExtension(
          ext,
          this as unknown as IExtensionHostService,
          this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionService),
          this.getExtensionExports(ext.id),
          this.getExtendExports(ext.id),
        ),
    );
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
      // 存下当前异常属于哪一个插件以便上报
      this.extensionErrors.set(error, extension);
      const traceMassage = `${error.name || 'Error'}: ${error.message || ''}${stackTraceMessage}`;
      return traceMassage;
    };
  }

  public async $updateExtHostData() {
    const extensions: IExtensionProps[] = await this.rpcProtocol
      .getProxy(MainThreadAPIIdentifier.MainThreadExtensionService)
      .$getExtensions();
    // node 层 extensionLocation 不使用 static 直接使用 file
    // node 层 extension 实例和 vscode 保持一致，并继承 IExtensionProps
    this.extensions = extensions.map((item) => ({
      ...item,
      l10n: item.packageJSON?.l10n,
      displayName: item.displayName || item.packageJSON.displayName,
      isUnderDevelopment: !!item.isDevelopment,
      publisher: item.packageJSON?.publisher,
      version: item.packageJSON?.version,
      engines: item.packageJSON?.engines,
      identifier: new ExtensionIdentifier(item.id),
      uuid: item.packageJSON?.__metadata?.id,
      extensionLocation: Uri.file(item.path),
    }));
    this.logger.debug(
      'extensions',
      this.extensions.map((extension) => extension.packageJSON.name),
    );

    this.extendExtHostErrorStackTrace();
  }

  public async $fireChangeEvent() {
    this.extensionsChangeEmitter.fire();
  }

  public createExtension(extensionDescription: IExtensionProps): KTExtension<any> {
    const activateExtension = this.extensionsActivator.get(extensionDescription.id);

    return new KTExtension(
      extensionDescription,
      this as unknown as IExtensionHostService,
      this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadExtensionService),
      activateExtension && activateExtension.exports,
      activateExtension && activateExtension.extendExports,
    );
  }

  public getExtension(extensionId: string): KTExtension<any> | undefined {
    const extensionDescription = this.extensions.find(
      (extension) => getExtensionId(extensionId) === getExtensionId(extension.id),
    );

    if (extensionDescription) {
      return this.createExtension(extensionDescription);
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
      return this.lookup(extensionModule.parent, (depth += 1));
    }

    return undefined;
  }

  private defineAPI() {
    const module = getNodeRequire()('module');
    const originalLoad = module._load;

    const that = this;
    module._load = function load(request: string, parent: any, isMain: any) {
      if (!__interceptModule.some((m) => m === request)) {
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
      switch (request) {
        case EInternalModule.VSCODE:
          return that.vscodeAPIImpl.load(extension);

        case EInternalModule.SUMI:
        case EInternalModule.KAITIAN:
          return that.openSumiAPIImpl.load(extension, that.vscodeAPIImpl.load(extension));

        case EInternalModule.TELEMETRY:
          return that.telemetryAPIImpl.load(extension);

        default:
          break;
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

  private containsSumiContributes(extension: IExtensionDescription): boolean {
    if (extension.packageJSON.sumiContributes) {
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
    const extension: IExtensionDescription | undefined = this.extensions.find((ext) => ext.id === id);

    if (!extension) {
      this.logger.error(`extension ${id} not found`);
      return;
    }
    await this.localization.initializeLocalizedMessages(extension);

    if (this.extensionsActivator.get(id)) {
      this.logger.warn(`extension ${id} is already activated.`);
      return;
    }

    const isSumiContributes = this.containsSumiContributes(extension);

    const modulePath: string = extension.path;
    this.logger.debug(`${extension.name} - ${modulePath}`);

    this.logger.debug(`active extension host process by ${modulePath}`);
    const extendProxy = this.getExtendModuleProxy(extension, isSumiContributes);

    const context = await this.loadExtensionContext(extension, modulePath, this.storage, this.secret, extendProxy);

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
      } catch (error) {
        activationFailed = true;
        activationFailedError = error;
        this.logger.error(`active extension ${extension.id} failure by\n${error}`);
      }

      if (extensionModule.activate) {
        this.logger.debug(`try activate ${extension.name}`);
        // FIXME: 考虑在 Context 这里直接注入服务注册的能力
        try {
          const reportTimer = this.reporterService.time(REPORT_NAME.ACTIVE_EXTENSION);
          const extensionExports = (await extensionModule.activate(context)) || extensionModule;
          reportTimer.timeEnd(extension.id, {
            version: extension.packageJSON.version,
          });
          exportsData = extensionExports;
        } catch (error) {
          activationFailed = true;
          activationFailedError = error;
          this.logger.error(`active extension ${extension.id} failure by\n${error}`);
        }
      }
    }

    if (extension.packageJSON.sumiContributes && extension.packageJSON.sumiContributes.nodeMain) {
      try {
        const reportTimer = this.reporterService.time(REPORT_NAME.ACTIVE_EXTENSION);
        extendModule = getNodeRequire()(path.join(extension.path, extension.packageJSON.sumiContributes.nodeMain));
        reportTimer.timeEnd(extension.id, {
          version: extension.packageJSON.version,
        });
      } catch (error) {
        activationFailed = true;
        activationFailedError = error;
        this.reportRuntimeError(error, extension, error.stack);
        this.logger.error(`active extension ${extension.id} failure by\n${error}`);
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
      } catch (error) {
        activationFailed = true;
        activationFailedError = error;
        this.reportRuntimeError(error, extension, error.stack);
        this.logger.error(`active extension extend module failure by\n${error}`);
      }
    }
    this.extensionsActivator.set(
      id,
      new ActivatedExtension(
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
      ),
    );
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

  private getExtendModuleProxy(extension: IExtensionDescription, isSumiContributes: boolean) {
    /**
     * @example
     * "sumiContributes": {
     *  "viewsProxies": ["ViewComponentID"],
     * }
     */
    if (
      isSumiContributes &&
      extension.packageJSON.sumiContributes &&
      extension.packageJSON.sumiContributes.viewsProxies
    ) {
      return this.getExtensionViewModuleProxy(extension, extension.packageJSON.sumiContributes.viewsProxies);
    } else if (extension.extendConfig && extension.extendConfig.browser && extension.extendConfig.browser.componentId) {
      return this.getExtensionViewModuleProxy(extension, extension.extendConfig.browser.componentId);
    } else {
      return {};
    }
  }

  private registerExtendModuleService(exportsData, extension: IExtensionDescription) {
    const service = {};
    for (const key in exportsData) {
      // eslint-disable-next-line no-prototype-builtins
      if (exportsData.hasOwnProperty(key)) {
        if (typeof exportsData[key] === 'function') {
          service[`$${key}`] = exportsData[key];
        }
      }
    }

    this.logger.debug('extension extend service', extension.id, 'service', service);
    this.rpcProtocol.set(
      { serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extension.id}` } as ProxyIdentifier<any>,
      service,
    );
  }

  public async $activateExtension(id: string) {
    return this.activateExtension(id);
  }

  private async loadExtensionContext(
    extensionDescription: IExtensionDescription,
    modulePath: string,
    storageProxy: ExtHostStorage,
    secretProxy: ExtHostSecret,
    extendProxy: IExtendProxy,
  ) {
    const extensionId = extensionDescription.id;
    const registerExtendFn = (exportsData) => this.registerExtendModuleService(exportsData, extensionDescription);

    const exthostTermianl = this.rpcProtocol.get(ExtHostAPIIdentifier.ExtHostTerminal);

    const context = new ExtensionContext({
      extensionDescription,
      extensionId,
      createExtension: this.createExtension.bind(this),
      extensionPath: modulePath,
      extensionLocation: extensionDescription.extensionLocation,
      storageProxy,
      secretProxy,
      extendProxy,
      registerExtendModuleService: registerExtendFn,
      exthostTerminal: exthostTermianl,
    });

    return Promise.all([context.globalState.whenReady, context.workspaceState.whenReady]).then(() =>
      Object.freeze(context),
    );
  }
}
