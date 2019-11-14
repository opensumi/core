import { Injector, ConstructorOf, Domain } from '@ali/common-di';
import { BrowserModule, IClientApp } from '../browser-module';
import { AppConfig } from '../react-providers';
import { injectInnerProviders } from './inner-providers';
import { KeybindingRegistry, KeybindingService, noKeybidingInputName } from '../keybinding';
import {
  CommandRegistry,
  MenuModelRegistry,
  isOSX, ContributionProvider,
  MaybePromise,
  createContributionProvider,
  DefaultResourceProvider,
  ResourceProvider,
  ResourceResolverContribution,
  InMemoryResourceResolver,
  StorageProvider,
  DefaultStorageProvider,
  StorageResolverContribution,
  ILoggerManagerClient,
  SupportLogNamespace,
  ILogServiceClient,
  getLogger,
  isElectronRenderer,
  setLanguageId,
} from '@ali/ide-core-common';
import { ClientAppStateService } from '../application';
import { ClientAppContribution } from '../common';
import { createNetClientConnection, createClientConnection2, bindConnectionService } from './connection';
import { RPCMessageConnection } from '@ali/ide-connection';
import {
  PreferenceProviderProvider, injectPreferenceSchemaProvider, injectPreferenceConfigurations, PreferenceScope, PreferenceProvider, PreferenceService, PreferenceServiceImpl, getPreferenceLanguageId,
} from '../preferences';
import { injectCorePreferences } from '../core-preferences';
import { ClientAppConfigProvider } from '../application';
import { CorePreferences } from '../core-preferences';
import { renderClientApp } from './app.view';
import { updateIconMap } from '../icon';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { electronEnv } from '../utils';
import { MenuRegistry, IMenuRegistry } from '../menu/next';

const DEFAULT_CDN_ICON = '//at.alicdn.com/t/font_1432262_e2ikewyk1kq.css';

export type ModuleConstructor = ConstructorOf<BrowserModule>;
export type ContributionConstructor = ConstructorOf<ClientAppContribution>;
export type Direction = ('left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top');
export interface IconMap {
  [iconKey: string]: string;
}
export interface IPreferences {
  [key: string]: any;
}
export interface IconInfo { cssPath: string; prefix: string; iconMap: IconMap; }
export interface IClientAppOpts extends Partial<AppConfig> {
  modules: ModuleConstructor[];
  layoutConfig?: LayoutConfig;
  contributions?: ContributionConstructor[];
  modulesInstances?: BrowserModule[];
  connectionPath?: string;
  webviewEndpoint?: string;
  connectionProtocols?: string[];
  extWorkerHost?: string;
  iconStyleSheets?: IconInfo[];
  useCdnIcon?: boolean;
  editorBackgroudImage?: string;
  defaultPreferences?: IPreferences;
}
export interface LayoutConfig {
  [area: string]: {
    modules: Array<string>;
    // TabPanel支持配置尺寸
    size?: number;
  };
}

// 设置全局应用信息
ClientAppConfigProvider.set({
  applicationName: 'KAITIAN',
  uriScheme: 'KT_KAITIAN',
});

export class ClientApp implements IClientApp {

  browserModules: BrowserModule[] = [];

  modules: ModuleConstructor[];

  injector: Injector;

  logger: ILogServiceClient;

  connectionPath: string;

  connectionProtocols?: string[];

  keybindingRegistry: KeybindingRegistry;

  keybindingService: KeybindingService;

  config: AppConfig;

  contributionsProvider: ContributionProvider<ClientAppContribution>;

  commandRegistry: CommandRegistry;

  menuRegistry: MenuModelRegistry;

  nextMenuRegistry: MenuRegistry;

  stateService: ClientAppStateService;

  container: HTMLElement;

  constructor(opts: IClientAppOpts) {
    setLanguageId(getPreferenceLanguageId());
    this.injector = opts.injector || new Injector();
    this.modules = opts.modules;
    this.modules.forEach((m) => this.resolveModuleDeps(m));
    // moduleInstance必须第一个是layout模块
    this.browserModules = opts.modulesInstances || [];
    this.config = {
      workspaceDir: opts.workspaceDir || '',
      coreExtensionDir: opts.coreExtensionDir,
      extensionDir: opts.extensionDir || (isElectronRenderer() ? electronEnv.metadata.extensionDir : ''),
      injector: this.injector,
      wsPath: opts.wsPath || 'ws://127.0.0.1:8000',
      layoutConfig: opts.layoutConfig as LayoutConfig,
      webviewEndpoint: opts.webviewEndpoint,
      extWorkerHost: opts.extWorkerHost,
      appName: opts.appName,
      staticServicePath: opts.staticServicePath,
      editorBackgroudImage: opts.editorBackgroudImage,
      extensionCandidate: opts.extensionCandidate,
    };

    this.connectionPath = opts.connectionPath || `${this.config.wsPath}/service`;
    this.connectionProtocols = opts.connectionProtocols;
    this.initBaseProvider(opts);
    this.initFields();
    this.appendIconStyleSheets(opts.iconStyleSheets, opts.useCdnIcon);
    this.createBrowserModules(opts);
  }
  /**
   * 将被依赖但未被加入modules的模块加入到待加载模块最后
   */
  public resolveModuleDeps(moduleConstructor: ModuleConstructor) {
    const dependencies = Reflect.getMetadata('dependencies', moduleConstructor) as [];
    if (dependencies) {
      dependencies.forEach((dep) => {
        if (this.modules.indexOf(dep) === -1) {
          this.modules.push(dep);
        }
      });
    }
  }

  public async start(container: HTMLElement, type?: string, connection?: RPCMessageConnection) {
    if (connection) {
      await bindConnectionService(this.injector, this.modules, connection);
      console.log('extract connection');
    } else {
      if (type === 'electron') {
        const netConnection = await (window as any).createRPCNetConnection();
        await createNetClientConnection(this.injector, this.modules, netConnection);
      } else if (type === 'web') {

        await createClientConnection2(this.injector, this.modules, this.connectionPath, () => {
          this.onReconnectContributions();
        }, this.connectionProtocols);
      }
    }
    this.logger = this.injector.get(ILoggerManagerClient).getLogger(SupportLogNamespace.Browser);
    this.stateService.state = 'client_connected';
    console.time('startContribution');
    await this.startContributions();
    console.timeEnd('startContribution');
    this.stateService.state = 'started_contributions';
    this.registerEventListeners();
    await this.renderApp(container);
    this.stateService.state = 'ready';
  }

  private onReconnectContributions() {
    const contributions = this.contributions;

    for (const contribution of contributions) {
      if (contribution.onReconnect) {
        contribution.onReconnect(this);
      }
    }
  }

  /**
   * 给 injector 初始化默认的 Providers
   */
  private initBaseProvider(opts: IClientAppOpts) {
    this.injector.addProviders({ token: IClientApp, useValue: this });
    this.injector.addProviders({ token: AppConfig, useValue: this.config });
    injectInnerProviders(this.injector);
  }

  /**
   * 从 injector 里获得实例
   */
  private initFields() {
    this.contributionsProvider = this.injector.get(ClientAppContribution);
    this.commandRegistry = this.injector.get(CommandRegistry);
    this.keybindingRegistry = this.injector.get(KeybindingRegistry);
    this.keybindingService = this.injector.get(KeybindingService);
    this.stateService = this.injector.get(ClientAppStateService);
    this.menuRegistry = this.injector.get(MenuModelRegistry);
    this.nextMenuRegistry = this.injector.get(IMenuRegistry);
  }

  private createBrowserModules(opts: IClientAppOpts) {
    const injector = this.injector;

    for (const Constructor of this.modules) {
      const instance = injector.get(Constructor);
      this.browserModules.push(instance);

      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }

      if (instance.preferences) {
        instance.preferences(this.injector);
      }
    }

    injectCorePreferences(this.injector);

    // 注册PreferenceService
    this.injectPreferenceService(this.injector, opts);

    // 注册资源处理服务
    this.injectResourceProvider(this.injector);

    // 注册存储服务
    this.injectStorageProvider(this.injector);

    for (const instance of this.browserModules) {

      if (instance.contributionProvider) {
        if (Array.isArray(instance.contributionProvider)) {
          for (const contributionProvider of instance.contributionProvider) {
            createContributionProvider(this.injector, contributionProvider);
          }
        } else {
          createContributionProvider(this.injector, instance.contributionProvider);
        }
      }
    }
  }

  get contributions(): ClientAppContribution[] {
    return this.contributionsProvider.getContributions();
  }

  protected async startContributions() {
    console.log('startContributions clientAppContributions', this.contributions);
    for (const contribution of this.contributions) {
      if (contribution.initialize) {
        try {
          console.log((contribution.constructor as any).name + '.initialize');
          await this.measure(contribution.constructor.name + '.initialize',
            () => contribution.initialize!(this),
          );
        } catch (error) {
          this.logger.error('Could not initialize contribution', error);
        }
      }
    }

    console.log('contributions.initialize done');

    this.commandRegistry.onStart();
    this.keybindingRegistry.onStart();
    this.menuRegistry.onStart();
    this.nextMenuRegistry.onStart();

    for (const contribution of this.contributions) {
      if (contribution.onStart) {
        try {
          console.log(contribution.constructor.name + '.onStart start');
          await this.measure(contribution.constructor.name + '.onStart',
            () => contribution.onStart!(this),
          );
          console.log(contribution.constructor.name + '.onStart done');
        } catch (error) {
          this.logger.error('Could not start contribution', error);
        }
      }
    }

  }

  private async renderApp(container: HTMLElement) {
    this.container = container;
    await renderClientApp(this, this.container);

    for (const contribution of this.contributions) {
      if (contribution.onDidStart) {
        try {
          await this.measure(contribution.constructor.name + '.onDidStart',
            () => contribution.onDidStart!(this),
          );
        } catch (error) {
          this.logger.error('Could not start contribution', error);
        }
      }
    }
  }

  protected async measure<T>(name: string, fn: () => MaybePromise<T>): Promise<T> {
    const startMark = name + '-start';
    const endMark = name + '-end';
    performance.mark(startMark);
    const result = await fn();
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);
    for (const item of performance.getEntriesByName(name)) {
      if (item.duration > 100) {
        console.warn(item.name + ' is slow, took: ' + item.duration + ' ms');
      } else {
        console.debug(item.name + ' took ' + item.duration + ' ms');
      }
    }
    performance.clearMeasures(name);
    return result;
  }

  /**
   * `beforeunload` listener implementation
   */
  protected preventStop(): boolean {
    // 获取corePreferences配置判断是否弹出确认框
    const corePreferences = this.injector.get(CorePreferences);
    const confirmExit = corePreferences['application.confirmExit'];
    if (confirmExit === 'never') {
      return false;
    }
    for (const contribution of this.contributions) {
      if (contribution.onWillStop) {
        try {
          const res = contribution.onWillStop(this);
          if (!!res) {
            return true;
          }
        } catch (e) {
          getLogger().error(e); // TODO 这里无法落日志
        }
      }
    }
    return confirmExit === 'always';
  }

  /**
   * electron 退出询问
   */
  protected async preventStopElectron(): Promise<boolean> {
    // 获取corePreferences配置判断是否弹出确认框
    const corePreferences = this.injector.get(CorePreferences);
    const confirmExit = corePreferences['application.confirmExit'];
    if (confirmExit === 'never') {
      return false;
    }
    for (const contribution of this.contributions) {
      if (contribution.onWillStop) {
        try {
          const res = await contribution.onWillStop(this);
          if (!!res) {
            return true;
          }
        } catch (e) {
          getLogger().error(e); // TODO 这里无法落日志
        }
      }
    }
    return confirmExit === 'always';
  }

  /**
   * Stop the frontend application contributions. This is called when the window is unloaded.
   */
  protected stopContributions(): void {
    for (const contribution of this.contributions) {
      if (contribution.onStop) {
        try {
          contribution.onStop(this);
        } catch (error) {
          this.logger.error('Could not stop contribution', error);
        }
      }
    }
  }

  protected async stopContributionsElectron(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    for (const contribution of this.contributions) {
      if (contribution.onStop) {
        promises.push((async () => {
          try {
            await contribution.onStop!(this);
          } catch (error) {
            this.logger.error('Could not stop contribution', error);
          }
        })());
      }
    }
    await Promise.all(promises);
  }

  /**
   * 注册全局事件监听
   */
  protected registerEventListeners(): void {
    window.addEventListener('beforeunload', (event) => {
      // 浏览器关闭事件前
      if (isElectronRenderer()) {
        if (this.stateService.state === 'electron_confirmed_close') {
          return;
        }
        // 在electron上，先直接prevent, 然后进入ask环节
        event.returnValue = '';
        event.preventDefault();
        if (this.stateService.state !== 'electron_asking_close') {
          this.stateService.state = 'electron_asking_close';
          this.preventStopElectron().then((res) => {
            if (res) {
              this.stateService.state = 'ready';
            } else {
              return this.stopContributionsElectron().then(() => {
                this.stateService.state = 'electron_confirmed_close';
                const electronLifeCycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
                electronLifeCycle.closeWindow(electronEnv.currentWindowId);
              });
            }
          });
        }
      } else {
        // 为了避免不必要的弹窗，如果页面并没有发生交互浏览器可能不会展示在 beforeunload 事件中引发的弹框，甚至可能即使发生交互了也直接不显示。
        if (this.preventStop()) {
          (event || window.event).returnValue = true;
          return true;
        }
      }
    });
    window.addEventListener('unload', () => {
      // 浏览器关闭事件
      this.stateService.state = 'closing_window';
      if (!isElectronRenderer()) {
        this.stopContributions();
      }
    });

    window.addEventListener('resize', () => {
      // 浏览器resize事件
    });
    document.addEventListener('keydown', (event: any) => {
      if (event && event.target!.name !== noKeybidingInputName) {
        this.keybindingService.run(event);
      }
    }, true);

    if (isOSX) {
      document.body.addEventListener('wheel', (event) => {
        // 屏蔽在OSX系统浏览器中由于滚动导致的前进后退事件
      }, { passive: false });
    }
  }

  injectPreferenceService(injector: Injector, opts: IClientAppOpts): void {
    const preferencesProviderFactory = () => {
      return (scope: PreferenceScope) => {
        return injector.get(PreferenceProvider, { tag: scope });
      };
    };
    injectPreferenceConfigurations(this.injector);

    injectPreferenceSchemaProvider(injector);

    // 用于获取不同scope下的PreferenceProvider
    injector.addProviders({
      token: PreferenceProviderProvider,
      useFactory: preferencesProviderFactory,
    }, {
      token: PreferenceService,
      useClass: PreferenceServiceImpl,
    });
    // 设置默认配置
    if (opts.defaultPreferences) {
      const preferenceService: PreferenceService = injector.get(PreferenceService);
      for (const key of Object.keys(opts.defaultPreferences)) {
        preferenceService.set(key, opts.defaultPreferences[key], PreferenceScope.Default);
      }
    }
  }

  injectResourceProvider(injector: Injector) {
    injector.addProviders({
      token: DefaultResourceProvider,
      useClass: DefaultResourceProvider,
    });
    injector.addProviders({
      token: ResourceProvider,
      useFactory: () => {
        return (uri) => {
          return injector.get(DefaultResourceProvider).get(uri);
        };
      },
    });
    createContributionProvider(injector, ResourceResolverContribution);
    // 添加默认的内存资源处理contribution
    injector.addProviders(InMemoryResourceResolver);
  }

  injectStorageProvider(injector: Injector) {
    injector.addProviders({
      token: DefaultStorageProvider,
      useClass: DefaultStorageProvider,
    });
    injector.addProviders({
      token: StorageProvider,
      useFactory: () => {
        return (storageId) => {
          return injector.get(DefaultStorageProvider).get(storageId);
        };
      },
    });
    createContributionProvider(injector, StorageResolverContribution);
  }

  /**
   * 通知上层需要刷新浏览器
   * @param forcedReload 当取值为 true 时，将强制浏览器从服务器重新获取当前页面资源，而不是从浏览器的缓存中读取，如果取值为 false 或不传该参数时，浏览器则可能会从缓存中读取当前页面。
   */
  fireOnReload(forcedReload: boolean = false) {
    // 默认调用 location reload
    window.location.reload(forcedReload);
  }

  protected appendIconStyleSheets(iconInfos?: IconInfo[], useCdnIcon?: boolean) {
    const iconPaths: string[] = useCdnIcon ? [DEFAULT_CDN_ICON] : [];
    if (iconInfos && iconInfos.length) {
      iconInfos.forEach((info) => {
        this.updateIconMap(info.prefix, info.iconMap);
        iconPaths.push(info.cssPath);
      });
    }
    for (const path of iconPaths) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', path);
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }

  protected updateIconMap(prefix: string, iconMap: IconMap) {
    if (prefix === 'kaitian-icon kticon-') {
      console.warn('icon prefix与内置图标冲突，请检查图标配置！');
    }
    updateIconMap(prefix, iconMap);
  }

}
