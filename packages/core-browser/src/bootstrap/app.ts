/**
 * editor.main 包含了所有 monaco 自带的编辑器相关核心功能以及 contributes
 * 并且 editor.main 也包含对 editor.all 的导入
 */
import '@opensumi/monaco-editor-core/esm/vs/editor/editor.main';
import ResizeObserver from 'resize-observer-polyfill';

import { Injector, ConstructorOf } from '@opensumi/di';
import { RPCMessageConnection } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import {
  CommandRegistry,
  isOSX,
  ContributionProvider,
  MaybePromise,
  createContributionProvider,
  StorageProvider,
  DefaultStorageProvider,
  StorageResolverContribution,
  ILoggerManagerClient,
  SupportLogNamespace,
  ILogServiceClient,
  getDebugLogger,
  isElectronRenderer,
  setLanguageId,
  IReporterService,
  REPORT_NAME,
  IEventBus,
  asExtensionCandidate,
  IApplicationService,
  IDisposable,
  Deferred,
} from '@opensumi/ide-core-common';
import {
  DEFAULT_APPLICATION_DESKTOP_HOST,
  DEFAULT_APPLICATION_NAME,
  DEFAULT_APPLICATION_WEB_HOST,
  DEFAULT_URI_SCHEME,
} from '@opensumi/ide-core-common/lib/const/application';
import { IElectronMainLifeCycleService } from '@opensumi/ide-core-common/lib/electron';

import { ClientAppStateService } from '../application';
import { BrowserModule, IClientApp } from '../browser-module';
import { ClientAppContribution } from '../common';
import { CorePreferences } from '../core-preferences';
import { injectCorePreferences } from '../core-preferences';
import { KeybindingRegistry, KeybindingService, NO_KEYBINDING_NAME } from '../keybinding';
import { RenderedEvent } from '../layout';
import { MenuRegistryImpl, IMenuRegistry } from '../menu/next';
import {
  PreferenceProviderProvider,
  injectPreferenceSchemaProvider,
  injectPreferenceConfigurations,
  PreferenceScope,
  PreferenceProvider,
  PreferenceService,
  PreferenceServiceImpl,
  getPreferenceLanguageId,
  registerLocalStorageProvider,
} from '../preferences';
import { AppConfig } from '../react-providers';
import { DEFAULT_CDN_ICON, IDE_OCTICONS_CN_CSS, IDE_CODICONS_CN_CSS, updateIconMap } from '../style/icon/icon';
import { electronEnv } from '../utils';

import { renderClientApp, IAppRenderer } from './app.view';
import { createNetClientConnection, createClientConnection2, bindConnectionService } from './connection';
import { injectInnerProviders } from './inner-providers';

export type ModuleConstructor = ConstructorOf<BrowserModule>;
export type ContributionConstructor = ConstructorOf<ClientAppContribution>;
export type Direction = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
export interface IconMap {
  [iconKey: string]: string;
}
export interface IPreferences {
  [key: string]: any;
}
export interface IconInfo {
  cssPath: string;
  prefix: string;
  iconMap: IconMap;
}
export interface IClientAppOpts extends Partial<AppConfig> {
  modules: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: BrowserModule[];
  connectionPath?: string;
  connectionProtocols?: string[];
  iconStyleSheets?: IconInfo[];
  useCdnIcon?: boolean;
  editorBackgroundImage?: string;
  /**
   * 插件开发模式下指定的插件路径
   */
  extensionDevelopmentPath?: string | string[];
}

export interface LayoutConfig {
  [area: string]: {
    modules: Array<string>;
    // @deprecated
    size?: number;
  };
}

// 添加resize observer polyfill
if (typeof (window as any).ResizeObserver === 'undefined') {
  (window as any).ResizeObserver = ResizeObserver;
}

export class ClientApp implements IClientApp, IDisposable {
  /**
   * 应用是否完成初始化
   */
  appInitialized: Deferred<void> = new Deferred();

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

  // 这里将 onStart contribution 方法放到 MenuRegistryImpl 上了
  nextMenuRegistry: MenuRegistryImpl;

  stateService: ClientAppStateService;

  constructor(opts: IClientAppOpts) {
    const {
      modules,
      contributions,
      modulesInstances,
      connectionPath,
      connectionProtocols,
      iconStyleSheets,
      useCdnIcon,
      editorBackgroundImage,
      defaultPreferences,
      allowSetDocumentTitleFollowWorkspaceDir = true,
      ...restOpts // rest part 为 AppConfig
    } = opts;
    this.initEarlyPreference(opts.workspaceDir || '');
    setLanguageId(getPreferenceLanguageId(defaultPreferences));
    this.injector = opts.injector || new Injector();
    this.modules = modules;
    this.modules.forEach((m) => this.resolveModuleDeps(m));
    // moduleInstance必须第一个是layout模块
    this.browserModules = opts.modulesInstances || [];

    this.config = {
      appName: DEFAULT_APPLICATION_NAME,
      appHost: isElectronRenderer() ? DEFAULT_APPLICATION_DESKTOP_HOST : DEFAULT_APPLICATION_WEB_HOST,
      uriScheme: DEFAULT_URI_SCHEME,
      // 如果通过 config 传入了 appName 及 uriScheme，则优先使用
      ...restOpts,
      // 一些转换和 typo 修复
      isElectronRenderer: opts.isElectronRenderer || isElectronRenderer(),
      workspaceDir: opts.workspaceDir || '',
      extensionDir:
        opts.extensionDir ||
        (opts.isElectronRenderer || isElectronRenderer() ? electronEnv.metadata?.extensionDir : ''),
      injector: this.injector,
      wsPath: opts.wsPath || 'ws://0.0.0.0:8000',
      layoutConfig: opts.layoutConfig as LayoutConfig,
      editorBackgroundImage: opts.editorBackgroundImage || editorBackgroundImage,
      allowSetDocumentTitleFollowWorkspaceDir,
    };

    if (this.config.isElectronRenderer && electronEnv.metadata?.extensionDevelopmentHost) {
      this.config.extensionDevelopmentHost = electronEnv.metadata.extensionDevelopmentHost;
    }

    if (opts.extensionDevelopmentPath) {
      this.config.extensionCandidate = (this.config.extensionCandidate || []).concat(
        Array.isArray(opts.extensionDevelopmentPath)
          ? opts.extensionDevelopmentPath.map((e) => asExtensionCandidate(e, true))
          : [asExtensionCandidate(opts.extensionDevelopmentPath, true)],
      );

      this.config.extensionDevelopmentHost = !!opts.extensionDevelopmentPath;
    }

    // 旧方案兼容, 把electron.metadata.extensionCandidate提前注入appConfig的对应配置中
    if (this.config.isElectronRenderer && electronEnv.metadata?.extensionCandidate) {
      this.config.extensionCandidate = (this.config.extensionCandidate || []).concat(
        electronEnv.metadata.extensionCandidate || [],
      );
    }

    this.connectionPath = connectionPath || `${this.config.wsPath}/service`;
    this.connectionProtocols = connectionProtocols;
    this.initBaseProvider();
    this.initFields();
    this.appendIconStyleSheets(iconStyleSheets, useCdnIcon);
    this.createBrowserModules(defaultPreferences);
  }

  private _inComposition = false;

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

  public async start(
    container: HTMLElement | IAppRenderer,
    type?: string,
    connection?: RPCMessageConnection,
  ): Promise<void> {
    const reporterService: IReporterService = this.injector.get(IReporterService);
    const measureReporter = reporterService.time(REPORT_NAME.MEASURE);

    if (connection) {
      await bindConnectionService(this.injector, this.modules, connection);
    } else {
      if (type === 'electron') {
        const netConnection = await (window as any).createRPCNetConnection();
        await createNetClientConnection(this.injector, this.modules, netConnection);
      } else if (type === 'web') {
        await createClientConnection2(
          this.injector,
          this.modules,
          this.connectionPath,
          () => {
            this.onReconnectContributions();
          },
          this.connectionProtocols,
          this.config.clientId,
        );

        this.logger = this.getLogger();
        // 回写需要用到打点的 Logger 的地方
        this.injector.get(WSChannelHandler).replaceLogger(this.logger);
      }
    }
    measureReporter.timeEnd('ClientApp.createConnection');

    this.logger = this.getLogger();
    this.stateService.state = 'client_connected';
    this.registerEventListeners();
    // 在 connect 之后立即初始化数据，保证其它 module 能同步获取数据
    await this.injector.get(IApplicationService).initializeData();

    // 在 contributions 执行完 onStart 上报一次耗时
    await this.measure('Contributions.start', () => this.startContributions(container));
    this.stateService.state = 'started_contributions';
    this.stateService.state = 'ready';

    measureReporter.timeEnd('Framework.ready');
  }

  private getLogger() {
    if (this.logger) {
      return this.logger;
    }
    this.logger = this.injector.get(ILoggerManagerClient).getLogger(SupportLogNamespace.Browser);
    return this.logger;
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
  private initBaseProvider() {
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
    this.nextMenuRegistry = this.injector.get(IMenuRegistry);
  }

  private createBrowserModules(defaultPreferences?: IPreferences) {
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
    this.injectPreferenceService(this.injector, defaultPreferences);

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

  protected async startContributions(container) {
    // 先渲染 layout，模块视图的时序由layout控制
    await this.measure('RenderApp.render', () => this.renderApp(container));

    await this.measure('Contributions.initialize', () => this.initializeContributions());

    // 初始化命令、快捷键与菜单
    await this.initializeCoreRegistry();

    // 核心模块初始化完毕
    this.stateService.state = 'core_module_initialized';

    await this.measure('Contributions.onStart', () => this.onStartContributions());

    await this.runContributionsPhase(this.contributions, 'onDidStart');
  }

  /**
   * 初始化核心模板
   */
  private async initializeCoreRegistry() {
    this.commandRegistry.initialize();
    await this.keybindingRegistry.initialize();
    this.nextMenuRegistry.initialize();
  }

  /**
   * run contribution#initialize
   */
  private async initializeContributions() {
    this.logger.verbose('startContributions clientAppContributions', this.contributions);

    await this.runContributionsPhase(this.contributions, 'initialize');
    this.appInitialized.resolve();

    this.logger.verbose('contributions.initialize done');
  }

  /**
   * run contribution#onStart
   */
  private async onStartContributions() {
    await this.runContributionsPhase(this.contributions, 'onStart');
  }

  private async runContributionsPhase(contributions: ClientAppContribution[], phaseName: keyof ClientAppContribution) {
    return await Promise.all(
      contributions.map((contribution) => this.contributionPhaseRunner(contribution, phaseName)),
    );
  }

  private async contributionPhaseRunner(contribution: ClientAppContribution, phaseName: keyof ClientAppContribution) {
    const phase = contribution[phaseName];
    if (typeof phase === 'function') {
      try {
        const uid = contribution.constructor.name + '.' + phaseName;
        return await this.measure(uid, () => phase.call(contribution, this));
      } catch (error) {
        this.logger.error(`Could not run contribution#${phaseName}`, error);
      }
    }
  }

  private async renderApp(container: HTMLElement | IAppRenderer) {
    await renderClientApp(this, container);

    const eventBus = this.injector.get(IEventBus);
    eventBus.fire(new RenderedEvent());
  }

  protected async measure<T>(name: string, fn: () => MaybePromise<T>): Promise<T> {
    const reporterService: IReporterService = this.injector.get(IReporterService);
    const measureReporter = reporterService.time(REPORT_NAME.MEASURE);
    const result = await fn();
    measureReporter.timeEnd(name);
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
          if (res) {
            return true;
          }
        } catch (e) {
          getDebugLogger().error(e);
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
          if (res) {
            return true;
          }
        } catch (e) {
          getDebugLogger().error(e);
        }
      }
    }
    return false;
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
        promises.push(
          (async () => {
            try {
              await contribution.onStop!(this);
            } catch (error) {
              this.logger.error('Could not stop contribution', error);
            }
          })(),
        );
      }
    }
    await Promise.all(promises);
  }

  /**
   * 注册全局事件监听
   */
  protected registerEventListeners(): void {
    window.addEventListener('beforeunload', this._handleBeforeUpload);
    window.addEventListener('unload', this._handleUnload);

    window.addEventListener('resize', this._handleResize);
    // 处理中文输入回退时可能出现多个光标问题
    // https://github.com/eclipse-theia/theia/pull/6673
    window.addEventListener('compositionstart', this._handleCompositionstart);
    window.addEventListener('compositionend', this._handleCompositionend);
    window.addEventListener('keydown', this._handleKeydown, true);
    window.addEventListener('keyup', this._handleKeyup, true);

    if (isOSX) {
      document.body.addEventListener('wheel', this._handleWheel, { passive: false });
    }
  }

  injectPreferenceService(injector: Injector, defaultPreferences?: IPreferences): void {
    const preferencesProviderFactory = () => (scope: PreferenceScope) => {
      const provider: PreferenceProvider = injector.get(PreferenceProvider, { tag: scope });
      provider.asScope(scope);
      return provider;
    };
    injectPreferenceConfigurations(injector);

    injectPreferenceSchemaProvider(injector);

    // 用于获取不同scope下的PreferenceProvider
    injector.addProviders(
      {
        token: PreferenceProviderProvider,
        useFactory: preferencesProviderFactory,
      },
      {
        token: PreferenceService,
        useClass: PreferenceServiceImpl,
      },
    );
    // 设置默认配置
    if (defaultPreferences) {
      const providerFactory: PreferenceProviderProvider = injector.get(PreferenceProviderProvider);
      const defaultPreference: PreferenceProvider = providerFactory(PreferenceScope.Default);
      for (const key of Object.keys(defaultPreferences)) {
        defaultPreference.setPreference(key, defaultPreferences[key]);
      }
    }
  }

  injectStorageProvider(injector: Injector) {
    injector.addProviders({
      token: DefaultStorageProvider,
      useClass: DefaultStorageProvider,
    });
    injector.addProviders({
      token: StorageProvider,
      useFactory: () => (storageId) => injector.get(DefaultStorageProvider).get(storageId),
    });
    createContributionProvider(injector, StorageResolverContribution);
  }

  /**
   * 通知上层需要刷新浏览器
   * @param forcedReload 当取值为 true 时，将强制浏览器从服务器重新获取当前页面资源，而不是从浏览器的缓存中读取，如果取值为 false 或不传该参数时，浏览器则可能会从缓存中读取当前页面。
   */
  fireOnReload(forcedReload = false) {
    // 默认调用 location reload
    // @ts-ignore
    window.location.reload(forcedReload);
  }

  protected appendIconStyleSheets(iconInfos?: IconInfo[], useCdnIcon?: boolean) {
    const iconPaths: string[] = useCdnIcon ? [DEFAULT_CDN_ICON, IDE_OCTICONS_CN_CSS, IDE_CODICONS_CN_CSS] : [];
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
      this.logger.error('icon prefix与内置图标冲突，请检查图标配置！');
    }
    updateIconMap(prefix, iconMap);
  }

  protected initEarlyPreference(workspaceDir: string) {
    registerLocalStorageProvider('general.theme', workspaceDir);
    registerLocalStorageProvider('general.icon', workspaceDir);
    registerLocalStorageProvider('general.language', workspaceDir);
  }

  public async dispose() {
    window.removeEventListener('beforeunload', this._handleBeforeUpload);
    window.removeEventListener('unload', this._handleUnload);
    window.removeEventListener('resize', this._handleResize);
    window.removeEventListener('compositionstart', this._handleCompositionstart);
    window.removeEventListener('compositionend', this._handleCompositionend);
    window.removeEventListener('keydown', this._handleKeydown, true);
    if (isOSX) {
      document.body.removeEventListener('wheel', this._handleWheel);
    }

    this.disposeSideEffect();
  }

  private disposeSideEffect() {
    for (const contribution of this.contributions) {
      if (contribution.onDisposeSideEffects) {
        try {
          contribution.onDisposeSideEffects(this);
        } catch (error) {
          this.logger.error('Could not dispose contribution', error);
        }
      }
    }
  }

  private _handleBeforeUpload = (event: BeforeUnloadEvent) => {
    // 浏览器关闭事件前
    if (this.config.isElectronRenderer) {
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
              // 在下一个 event loop 执行，否则可能导致第一次无法关闭。
              setTimeout(() => {
                electronLifeCycle.closeWindow(electronEnv.currentWindowId);
              }, 0);
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
  };

  private _handleUnload = () => {
    // 浏览器关闭事件
    this.stateService.state = 'closing_window';
    if (!this.config.isElectronRenderer) {
      this.disposeSideEffect();
      this.stopContributions();
    }
  };

  private _handleResize = () => {
    // 浏览器resize事件
  };

  private _handleKeydown = (event: any) => {
    if (event && event.target!.name !== NO_KEYBINDING_NAME && !this._inComposition) {
      this.keybindingService.run(event);
    }
  };

  private _handleKeyup = (event: any) => {
    this.keybindingService.resolveModifierKey(event);
  };

  private _handleCompositionstart = () => {
    this._inComposition = true;
  };

  private _handleCompositionend = () => {
    this._inComposition = false;
  };

  private _handleWheel = () => {
    // 屏蔽在OSX系统浏览器中由于滚动导致的前进后退事件
  };
}
