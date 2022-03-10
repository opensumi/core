import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { warning } from '@opensumi/ide-components/lib/utils/warning';
import { IRPCProtocol, ProxyIdentifier } from '@opensumi/ide-connection';
import { AppConfig, IToolbarPopoverRegistry } from '@opensumi/ide-core-browser';
import {
  ContributionProvider,
  IExtensionProps,
  ILogger,
  replaceLocalizePlaceholder,
  URI,
  IReporterService,
  REPORT_NAME,
  getDebugLogger,
} from '@opensumi/ide-core-common';
import { Path, posix } from '@opensumi/ide-core-common/lib/path';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';

import {
  EXTENSION_EXTEND_SERVICE_PREFIX,
  IBrowserRequireInterceptorArgs,
  IExtension,
  IRequireInterceptorService,
  MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER,
  RequireInterceptorContribution,
} from '../common';
import { ActivatedExtensionJSON } from '../common/activator';
import {
  AbstractNodeExtProcessService,
  AbstractViewExtProcessService,
  AbstractWorkerExtProcessService,
} from '../common/extension.service';

import { ExtensionNoExportsView } from './components';
import { Extension } from './extension';
import { createProxiedWindow, createProxiedDocument } from './proxies';
import { retargetEvents } from './retargetEvents';
import { getShadowRoot } from './shadowRoot';
import { SumiBrowserContributionRunner } from './sumi-browser/contribution';
import { ISumiBrowserContributions } from './sumi-browser/types';
import { KtViewLocation } from './sumi/contributes/browser-views';

const LOAD_FAILED_CODE = 'load';

@Injectable()
export class ViewExtProcessService implements AbstractViewExtProcessService {
  /**
   * TODO: 支持底部面板多视图展示
   * should replace view component
   */
  static tabBarLocation = ['left', 'right'];

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IToolbarPopoverRegistry)
  private readonly toolbarPopoverRegistry: IToolbarPopoverRegistry;

  @Autowired(AbstractWorkerExtProcessService)
  private readonly workerExtensionService: AbstractWorkerExtProcessService;

  @Autowired(AbstractNodeExtProcessService)
  private readonly nodeExtensionService: AbstractNodeExtProcessService;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired(RequireInterceptorContribution)
  private readonly requireInterceptorContributionProvider: ContributionProvider<RequireInterceptorContribution>;

  @Autowired(IRequireInterceptorService)
  private readonly requireInterceptorService: IRequireInterceptorService<IBrowserRequireInterceptorArgs>;

  @Autowired(IReporterService)
  private readonly reporterService: IReporterService;

  private readonly debugLogger = getDebugLogger();

  private extensions: IExtension[] = [];

  // 被激活且在 contributes 中注册了 browserView 的 sumi 插件
  public activatedViewExtensionMap: Map<string, IExtension> = new Map();

  public getExtension(extensionId: string): IExtension | undefined {
    return this.extensions.find((n) => n.id === extensionId);
  }

  public async initExtension(extensions: IExtension[]): Promise<void> {
    this.extensions = extensions;
  }

  // noop
  async getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    return [];
  }

  getProxy(): void {
    return;
  }
  // noop
  async $activateExtension(extensionPath: string): Promise<void> {
    return;
  }
  // noop
  public async $getExtensions(): Promise<IExtensionProps[]> {
    return this.extensions.map((n) => n.toJSON());
  }

  // noop
  public async disposeProcess() {
    return;
  }

  // 注册视图插件的公共依赖, 如 React/ReactDOM
  public activate() {
    const contributions = this.requireInterceptorContributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerRequireInterceptor(this.requireInterceptorService);
    }

    this.extendExtensionErrorStackTrace();
  }

  private extendExtensionErrorStackTrace() {
    Error.stackTraceLimit = 100;
    Error.prepareStackTrace = (error: Error, stackTrace: any[]) => {
      let extension: IExtension | undefined;
      let stackTraceMessage = `Error: ${error.message}`;
      for (const call of stackTrace) {
        stackTraceMessage += `\n\tat ${call.toString()}`;
        if (!extension && call.isEval()) {
          const extensionId = call.getEvalOrigin();
          const maybeExtension = this.getExtension.apply(this, [extensionId]);
          if (maybeExtension) {
            extension = maybeExtension;
            const columnNumber = call.getColumnNumber();
            const lineNumber = call.getLineNumber();
            stackTraceMessage =
              `\n\tat ${extension.name} (${extension.workerScriptPath}:${lineNumber}:${columnNumber})` +
              stackTraceMessage;
          }
        }
      }

      if (extension) {
        const traceMessage = `${extension && extension.name} - ${error.name || 'Error'}: ${
          error.message || ''
        }${stackTraceMessage}`;
        this.debugLogger.log('get error', traceMessage);
        this.reportRuntimeError(error, extension, traceMessage);
        return traceMessage;
      }
      return error.stack;
    };
  }

  private reportRuntimeError(err: Error, extension: IExtension, stackTraceMessage: string): void {
    if (err && err.message) {
      this.reporterService.point(REPORT_NAME.RUNTIME_ERROR_EXTENSION, extension.id, {
        stackTraceMessage,
        error: err.message,
        version: extension.packageJSON?.version,
      });
    }
  }

  /**
   * @see [KtViewLocation](#KtViewLocation) view location
   */
  private getRegisterViewKind(location: KtViewLocation) {
    return ViewExtProcessService.tabBarLocation.includes(location) ? 'replace' : 'add';
  }

  public async activeExtension(extension: IExtension, protocol: IRPCProtocol) {
    const { extendConfig, packageJSON, contributes } = extension;
    // 对使用 kaitian.js 的老插件兼容
    // 因为可能存在即用了 kaitian.js 作为入口，又注册了 kaitianContributes 贡献点的插件
    if (extendConfig?.browser?.main) {
      warning(
        false,
        '[Deprecated warning]: kaitian.js is deprecated, please use `package.json#kaitianContributes` instead',
      );
      await this.activateExtensionByDeprecatedExtendConfig(extension as Extension);
      return;
    }

    // 激活 workerMain/browserMain 相关部分
    if (packageJSON.kaitianContributes && contributes?.browserMain) {
      await this.activeExtensionContributes(extension);
    }
  }

  private async activeExtensionContributes(extension: IExtension) {
    const { contributes } = extension;

    // 这里路径遵循 posix 方式，fsPath 会自动根据平台转换
    const browserModuleUri = new URI(
      extension.extensionLocation.with({
        path: posix.join(extension.extensionLocation.path, contributes.browserMain!),
      }),
    );
    const { moduleExports, proxiedHead } = await this.getExtensionModuleExports(browserModuleUri.toString(), extension);

    if (contributes.browserViews) {
      const { browserViews } = contributes;
      if (this.appConfig.useExperimentalShadowDom) {
        this.registerPortalShadowRoot(extension.id);
      }
      const viewsConfig = Object.keys(browserViews).reduce((config, location) => {
        config[location] = {
          type: this.getRegisterViewKind(location as KtViewLocation),
          view: browserViews[location].view.map(({ id, titleComponentId, title, ...other }) => ({
            ...other,
            title: replaceLocalizePlaceholder(title, extension.id),
            id,
            component: this.getModuleExportsComponent(moduleExports, extension, id, proxiedHead),
            titleComponent:
              titleComponentId &&
              this.getModuleExportsComponent(moduleExports, extension, titleComponentId, proxiedHead),
          })),
        };
        return config;
      }, {});
      this.registerBrowserComponent(viewsConfig, extension as Extension);
    }

    // toolbar
    if (contributes.toolbar && contributes.toolbar?.actions) {
      for (const action of contributes.toolbar.actions) {
        if (action.type === 'button' && action.popoverComponent) {
          const popoverComponent = moduleExports[action.popoverComponent];
          if (!popoverComponent) {
            this.logger.error(
              `Can not find CustomPopover from extension ${extension.id}, id: ${action.popoverComponent}`,
            );
            continue;
          }
          if (this.appConfig.useExperimentalShadowDom) {
            const shadowComponent = (props) =>
              getShadowRoot(
                popoverComponent,
                extension,
                props,
                action.popoverComponent,
                proxiedHead,
                this.appConfig.componentCDNType,
              );
            this.toolbarPopoverRegistry.registerComponent(
              `${extension.id}:${action.popoverComponent}`,
              shadowComponent,
            );
          } else {
            this.toolbarPopoverRegistry.registerComponent(
              `${extension.id}:${action.popoverComponent}`,
              popoverComponent,
            );
          }
        }
      }
    }
  }

  /*
   * @deprecated 废弃的用法兼容
   * 对于老的 kaitian.js 的兼容激活
   */
  private async activateExtensionByDeprecatedExtendConfig(extension: Extension) {
    const { extendConfig } = extension;
    this.logger.verbose(`register view by Deprecated config ${extension.id}`);
    const browserScriptURI = await this.staticResourceService.resolveStaticResource(
      URI.file(new Path(extension.path).join(extendConfig.browser.main).toString()),
    );
    try {
      // 备注: 这里 extension 就是 rawExtension 了
      const rawExtension = extension;
      if (this.appConfig.useExperimentalShadowDom) {
        this.registerPortalShadowRoot(extension.id);
        const { moduleExports, proxiedHead } = await this.loadBrowserModuleUseInterceptor<ISumiBrowserContributions>(
          browserScriptURI.toString(),
          extension,
          true /** use export default ... */,
        );
        this.registerBrowserComponent(
          this.normalizeDeprecatedViewsConfig(moduleExports, extension, proxiedHead),
          rawExtension!,
        );
      } else {
        const { moduleExports } = await this.loadBrowserModule<ISumiBrowserContributions>(
          browserScriptURI.toString(),
          extension,
          true /** use export default ... */,
        );
        this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(moduleExports, extension), rawExtension!);
      }
    } catch (err) {
      if (err.errorCode === LOAD_FAILED_CODE) {
        this.logger.error(
          `[Extension-Host] failed to load ${extension.name} - browser module, path: \n\n ${err.moduleId}`,
        );
      } else {
        this.logger.error(err);
      }
    }
  }

  private async getExtensionModuleExports(
    url: string,
    extension: IExtension,
  ): Promise<{ moduleExports: any; proxiedHead?: HTMLHeadElement }> {
    if (this.appConfig.useExperimentalShadowDom) {
      return await this.loadBrowserModuleUseInterceptor<ISumiBrowserContributions>(
        url,
        extension,
        false /** use named exports ... */,
      );
    }
    const { moduleExports } = await this.loadBrowserModule(url, extension, false);
    return { moduleExports };
  }

  private registerBrowserComponent(browserExported: any, extension: Extension) {
    this.activatedViewExtensionMap.set(extension.path, extension);

    if (browserExported.default) {
      browserExported = browserExported.default;
    }

    const contribution: ISumiBrowserContributions = browserExported;
    extension.addDispose(
      this.injector.get(SumiBrowserContributionRunner, [extension, contribution]).run({
        getExtensionExtendService: this.getExtensionExtendService.bind(this),
      }),
    );
  }

  private getExtensionExtendService(extension: IExtension, id: string) {
    const protocol = this.createExtensionExtendProtocol(extension, id);

    this.logger.log(`bind extend service for ${extension.id}:${id}`);
    return {
      extendProtocol: protocol,
      extendService: protocol.getProxy(MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER),
    };
  }

  private createExtensionExtendProtocol(extension: IExtension, componentId: string): IRPCProtocol {
    const { id: extensionId } = extension;

    const extendProtocol = new Proxy<{
      getProxy: (identifier: ProxyIdentifier<any>) => {
        node: any;
        worker: any;
      };
      set: <T>(identifier: ProxyIdentifier<T>, service: T) => void;
    }>(Object.create(null), {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        if (prop === 'getProxy') {
          return () => {
            let nodeProxy: ProxyConstructor | undefined;
            let workerProxy: ProxyConstructor | undefined;

            if (this.nodeExtensionService.protocol) {
              nodeProxy = this.createExtendProxy(this.nodeExtensionService.protocol, extensionId);
            }

            if (this.workerExtensionService.protocol) {
              workerProxy = this.createExtendProxy(this.workerExtensionService.protocol, extensionId);
            }

            return {
              node: nodeProxy,
              worker: workerProxy,
            };
          };
        } else if (prop === 'set') {
          const componentProxyIdentifier = {
            serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}:${componentId}`,
          };

          return (componentService) => {
            const service = {};
            for (const key in componentService) {
              if (componentService.hasOwnProperty(key)) {
                service[`$${key}`] = componentService[key];
              }
            }

            this.logger.log('componentProxyIdentifier', componentProxyIdentifier, 'service', service);
            if (this.workerExtensionService.protocol) {
              this.workerExtensionService.protocol.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
            }
            if (this.nodeExtensionService.protocol) {
              return this.nodeExtensionService.protocol.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
            }
          };
        }
      },
    });

    return extendProtocol as any;
  }

  private createExtendProxy(protocol: IRPCProtocol, extensionId: string): ProxyConstructor {
    const proxy = protocol.getProxy(new ProxyIdentifier(`${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}`));
    return this.dollarProxy(proxy);
  }

  private dollarProxy(proxy) {
    return new Proxy(proxy, {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        return obj[`$${prop}`];
      },
    });
  }

  private getModuleExportsComponent(
    moduleExports: any,
    extension: IExtension,
    id: string,
    proxiedHead?: HTMLHeadElement,
  ) {
    if (!moduleExports[id]) {
      return () => ExtensionNoExportsView(extension.id, id);
    }
    if (this.appConfig.useExperimentalShadowDom) {
      return (props) =>
        getShadowRoot(moduleExports[id], extension, props, id, proxiedHead, this.appConfig.componentCDNType);
    }
    return moduleExports[id];
  }

  private portalShadowRootMap: Map<string, ShadowRoot> = new Map();
  private shadowRootBodyMap: Map<string, HTMLBodyElement> = new Map();

  private registerPortalShadowRoot(extensionId: string): void {
    if (!this.portalShadowRootMap.has(extensionId)) {
      const portal = document.createElement('div');
      portal.setAttribute('id', `portal-shadow-root-${extensionId}`);
      document.body.appendChild(portal);
      const portalRoot = portal.attachShadow({ mode: 'open' });
      // const body = document.createElement('body');
      // portalRoot.appendChild(body);
      retargetEvents(portalRoot);
      this.portalShadowRootMap.set(extensionId, portalRoot);
    }
  }

  public getPortalShadowRoot(extensionId: string): ShadowRoot | undefined {
    return this.portalShadowRootMap.get(extensionId);
  }

  public getShadowRootBody(id: string): HTMLBodyElement | undefined {
    return this.shadowRootBodyMap.get(id);
  }

  private doFetch(url: string) {
    const options: RequestInit = {};
    if (this.appConfig.extensionFetchCredentials) {
      options.credentials = this.appConfig.extensionFetchCredentials;
    }
    const pendingFetch = fetch(url, options);
    return pendingFetch;
  }

  private getMockAmdLoader<T>(extension: IExtension, rpcProtocol?: IRPCProtocol) {
    const _exports: { default?: any } | T = {};
    const _module = { exports: _exports };
    const _require = (request: string) => {
      const interceptor = this.requireInterceptorService.getRequireInterceptor(request);
      return interceptor?.load({
        injector: this.injector,
        extension,
        rpcProtocol,
      });
    };
    return { _module, _exports, _require };
  }

  private async loadBrowserModule<T>(
    browserPath: string,
    extension: IExtension,
    defaultExports: boolean,
  ): Promise<any> {
    const loadTimer = this.reporterService.time(REPORT_NAME.LOAD_EXTENSION_MAIN);
    const pendingFetch = await this.doFetch(decodeURIComponent(browserPath));
    loadTimer.timeEnd(extension.id);
    const { _module, _exports, _require } = this.getMockAmdLoader<T>(extension, this.nodeExtensionService.protocol);
    const initFn = new Function(
      'module',
      'exports',
      'require',
      (await pendingFetch.text()) + `\n//# sourceURL=${extension.id}`,
    );
    initFn(_module, _exports, _require);
    return {
      moduleExports: defaultExports ? _module.exports.default : _module.exports,
    };
  }

  // view config related starts
  private normalizeDeprecatedViewsConfig(
    moduleExports: { [key: string]: any },
    extension: IExtension,
    proxiedHead?: HTMLHeadElement,
  ) {
    if (this.appConfig.useExperimentalShadowDom) {
      return Object.keys(moduleExports)
        .filter((key) => moduleExports[key] && Array.isArray(moduleExports[key].component))
        .reduce((pre, cur) => {
          pre[cur] = {
            view: moduleExports[cur].component.map(({ panel, id, ...other }) => ({
              ...other,
              id,
              component: (props) =>
                getShadowRoot(panel, extension, props, id, proxiedHead, this.appConfig.componentCDNType),
            })),
          };
          return pre;
        }, {});
    } else {
      const views = moduleExports.default ? moduleExports.default : moduleExports;
      return Object.keys(views)
        .filter((key) => views[key] && Array.isArray(views[key].component))
        .reduce((config, location) => {
          config[location] = {
            view: views[location].component.map(({ panel, ...other }) => ({
              ...other,
              component: panel,
            })),
          };
          return config;
        }, {});
    }
  }

  /**
   * 对于使用 kaitian.js 方式注册的 UI ，使用 default 导出
   * @example
   * ```ts
   * export default {
   *    left: {...},
   *    right: {...}
   * }
   * ```
   * 使用 browserViews Contributes 注册的 UI，不使用 default 导出，因为这种入口只导出组件，不包含 UI 相关配置
   * @example
   * ```ts
   * export const Component = {...};
   * export const ComponentB = {...};
   * ```
   */
  private async loadBrowserModuleUseInterceptor<T>(
    browserPath: string,
    extension: IExtension,
    defaultExports: boolean,
  ): Promise<{ moduleExports: T; proxiedHead: HTMLHeadElement }> {
    const loadTimer = this.reporterService.time(REPORT_NAME.LOAD_EXTENSION_MAIN);
    const pendingFetch = await this.doFetch(decodeURIComponent(browserPath));
    loadTimer.timeEnd(extension.id);
    const { _module, _exports, _require } = this.getMockAmdLoader<T>(extension, this.nodeExtensionService.protocol);
    const stylesCollection = [];
    const proxiedHead = document.createElement('head');
    const proxiedDocument = createProxiedDocument(proxiedHead);
    const proxiedWindow = createProxiedWindow(proxiedDocument, proxiedHead);

    const initFn = new Function(
      'module',
      'exports',
      'require',
      'styles',
      'document',
      'window',
      (await pendingFetch.text()) + `\n//# sourceURL=${extension.id}`,
    );

    initFn(_module, _exports, _require, stylesCollection, proxiedDocument, proxiedWindow);
    return {
      moduleExports: defaultExports ? _module.exports.default : _module.exports,
      proxiedHead,
    };
  }
}
