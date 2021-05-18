import { warning } from '@ali/ide-components/lib/utils/warning';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { getMockAmdLoader } from './loader';
import { IRPCProtocol, ProxyIdentifier } from '@ali/ide-connection';
import { EXTENSION_EXTEND_SERVICE_PREFIX, IExtension, MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER } from '../common';
import { IExtensionProps, ILogger, replaceLocalizePlaceholder, URI } from '@ali/ide-core-common';
import { AppConfig, IToolbarPopoverRegistry } from '@ali/ide-core-browser';
import { getShadowRoot } from './shadowRoot';
import { Path, posix } from '@ali/ide-core-common/lib/path';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

import { createProxiedWindow, createProxiedDocument } from './proxies';
import { retargetEvents } from './retargetEvents';
import { KtViewLocation } from './kaitian/contributes/browser-views';
import { ExtensionNoExportsView } from './components';
import { IKaitianBrowserContributions } from './kaitian-browser/types';
import { Extension } from './extension';
import { KaitianBrowserContributionRunner } from './kaitian-browser/contribution';
import { AbstractNodeExtProcessService, AbstractViewExtProcessService, AbstractWorkerExtProcessService } from '../common/extension.service';
import { ActivatedExtensionJSON } from '../common/activator';

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

  private extensions: IExtension[] = [];

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
  public activate() {}

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
      warning(false, '[Deprecated warning]: kaitian.js is deprecated, please use `package.json#kaitianContributes` instead');
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
    const browserModuleUri = new URI(extension.extensionLocation.with({
      path: posix.join(extension.extensionLocation.path, contributes.browserMain!),
    }));
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
            titleComponent: titleComponentId && this.getModuleExportsComponent(moduleExports, extension, titleComponentId, proxiedHead),
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
            this.logger.error(`Can not find CustomPopover from extension ${extension.id}, id: ${action.popoverComponent}`);
            continue;
          }
          if (this.appConfig.useExperimentalShadowDom) {
            const shadowComponent = (props) => getShadowRoot(popoverComponent, extension, props, action.popoverComponent, proxiedHead);
            this.toolbarPopoverRegistry.registerComponent(`${extension.id}:${action.popoverComponent}`, shadowComponent);
          } else {
            this.toolbarPopoverRegistry.registerComponent(`${extension.id}:${action.popoverComponent}`, popoverComponent);
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
    const browserScriptURI = await this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(extendConfig.browser.main).toString()));
    try {
      // 备注: 这里 extension 就是 rawExtension 了
      const rawExtension = extension;
      if (this.appConfig.useExperimentalShadowDom) {
        this.registerPortalShadowRoot(extension.id);
        const { moduleExports, proxiedHead } = await this.loadBrowserModuleUseInterceptor<IKaitianBrowserContributions>(browserScriptURI.toString(), extension, true /** use export default ... */);
        this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(moduleExports, extension, proxiedHead), rawExtension!);
      } else {
        const { moduleExports } = await this.loadBrowserModule<IKaitianBrowserContributions>(browserScriptURI.toString(), extension, true /** use export default ... */);
        this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(moduleExports, extension), rawExtension!);
      }
    } catch (err) {
      if (err.errorCode === LOAD_FAILED_CODE) {
        this.logger.error(`[Extension-Host] failed to load ${extension.name} - browser module, path: \n\n ${err.moduleId}`);
      } else {
        this.logger.error(err);
      }
    }
  }

  private async getExtensionModuleExports(url: string, extension: IExtension): Promise<{ moduleExports: any; proxiedHead?: HTMLHeadElement }> {
    if (this.appConfig.useExperimentalShadowDom) {
      return await this.loadBrowserModuleUseInterceptor<IKaitianBrowserContributions>(url, extension, false /** use named exports ... */);
    }
    const { moduleExports } = await this.loadBrowserModule(url, extension, false);
    return { moduleExports };
  }

  private registerBrowserComponent(browserExported: any, extension: Extension) {
    if (browserExported.default) {
      browserExported = browserExported.default;
    }

    const contribution: IKaitianBrowserContributions = browserExported;
    extension.addDispose(this.injector.get(KaitianBrowserContributionRunner, [extension, contribution]).run({
      getExtensionExtendService: this.getExtensionExtendService.bind(this),
    }));
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
        node: any,
        worker: any,
      },
      set: <T>(identifier: ProxyIdentifier<T>, service: T) => void,
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
          const componentProxyIdentifier = { serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}:${componentId}` };

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

  private getModuleExportsComponent(moduleExports: any, extension: IExtension, id: string, proxiedHead?: HTMLHeadElement) {
    if (!moduleExports[id]) {
      return () => ExtensionNoExportsView(extension.id, id);
    }
    if (this.appConfig.useExperimentalShadowDom) {
      return (props) => getShadowRoot(moduleExports[id], extension, props, id, proxiedHead);
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

  private async loadBrowserModule<T>(browserPath: string, extension: IExtension, defaultExports: boolean): Promise<any> {
    const pendingFetch = await this.doFetch(decodeURIComponent(browserPath));
    const { _module, _exports, _require } = getMockAmdLoader<T>(this.injector, extension, this.nodeExtensionService.protocol);

    const initFn = new Function('module', 'exports', 'require', await pendingFetch.text());

    initFn(_module, _exports, _require);
    return {
      moduleExports: defaultExports ? _module.exports.default : _module.exports,
    };
  }

  // view config related starts
  private normalizeDeprecatedViewsConfig(moduleExports: { [key: string]: any }, extension: IExtension, proxiedHead?: HTMLHeadElement) {
    if (this.appConfig.useExperimentalShadowDom) {
      return Object.keys(moduleExports).filter((key) => moduleExports[key] && Array.isArray(moduleExports[key].component)).reduce((pre, cur) => {
        pre[cur] = {
          view: moduleExports[cur].component.map(({ panel, id, ...other }) => ({
            ...other,
            id,
            component: (props) => getShadowRoot(panel, extension, props, id, proxiedHead),
          })),
        };
        return pre;
      }, {});
    } else {
      const views = moduleExports.default ? moduleExports.default : moduleExports;
      return Object.keys(views).filter((key) => views[key] && Array.isArray(views[key].component)).reduce((config, location) => {
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
  ): Promise<{ moduleExports: T, proxiedHead: HTMLHeadElement }> {
    const pendingFetch = await this.doFetch(decodeURIComponent(browserPath));
    const { _module, _exports, _require } = getMockAmdLoader<T>(this.injector, extension, this.nodeExtensionService.protocol);
    const stylesCollection = [];
    const proxiedHead = document.createElement('head');
    const proxiedDocument = createProxiedDocument(proxiedHead);
    const proxiedWindow = createProxiedWindow(proxiedDocument, proxiedHead);

    const initFn = new Function('module', 'exports', 'require', 'styles', 'document', 'window', await pendingFetch.text());

    initFn(_module, _exports, _require, stylesCollection, proxiedDocument, proxiedWindow);
    return {
      moduleExports: defaultExports ? _module.exports.default : _module.exports,
      proxiedHead,
    };
  }
}
