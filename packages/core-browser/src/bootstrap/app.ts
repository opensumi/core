import { Injector, ConstructorOf, Domain } from '@ali/common-di';
import { BrowserModule, IClientApp } from '../browser-module';
import { AppConfig } from '../react-providers';
import { injectInnerProviders } from './inner-providers';
import { KeybindingRegistry, KeybindingService } from '../keybinding';
import { CommandRegistry, MenuModelRegistry, isOSX, ContributionProvider, getLogger, ILogger, MaybePromise, createContributionProvider } from '@ali/ide-core-common';
import { ClientAppStateService } from '../services/clientapp-status-service';

import { createClientConnection2 } from './connection';

export type ModuleConstructor = ConstructorOf<BrowserModule>;
export type ContributionConstructor = ConstructorOf<ClientAppContribution>;

export interface IClientAppOpts extends Partial<AppConfig> {
  modules: ModuleConstructor[];
  layoutConfig?: LayoutConfig;
  contributions?: ContributionConstructor[];
  modulesInstances?: BrowserModule[];
  connectionPath?: string;
  isElectron?: boolean;
}

export const ClientAppContribution = Symbol('ClientAppContribution');

export interface LayoutConfig {
  [area: string]: {
    modules: Array<Domain|ModuleConstructor>;
  };
}

export interface ClientAppContribution {
  /**
   * Called on application startup before commands, key bindings and menus are initialized.
   * Should return a promise if it runs asynchronously.
   */
  initialize?(app: IClientApp): MaybePromise<void>;

  /**
   * Called when the application is started. The application shell is not attached yet when this method runs.
   * Should return a promise if it runs asynchronously.
   */
  onStart?(app: IClientApp): MaybePromise<void>;

  /**
   * Called on `beforeunload` event, right before the window closes.
   * Return `true` in order to prevent exit.
   * Note: No async code allowed, this function has to run on one tick.
   */
  onWillStop?(app: IClientApp): boolean | void;

  /**
   * Called when an application is stopped or unloaded.
   *
   * Note that this is implemented using `window.unload` which doesn't allow any asynchronous code anymore.
   * I.e. this is the last tick.
   */
  onStop?(app: IClientApp): void;
}

export class ClientApp implements IClientApp {

  browserModules: BrowserModule[] = [];

  modules: ModuleConstructor[];

  injector: Injector;

  logger: ILogger = getLogger();

  connectionPath: string;

  keybindingRegistry: KeybindingRegistry;

  keybindingService: KeybindingService;

  config: AppConfig;

  contributionsProvider: ContributionProvider<ClientAppContribution>;

  commandRegistry: CommandRegistry;

  menuRegistry: MenuModelRegistry;

  stateService: ClientAppStateService;

  constructor(opts: IClientAppOpts) {
    this.injector = opts.injector || new Injector();
    this.modules = opts.modules;

    // moduleInstance必须第一个是layout模块
    this.browserModules = opts.modulesInstances || [];
    this.config = {
      workspaceDir: opts.workspaceDir || '',
      coreExtensionDir: opts.coreExtensionDir,
      injector: this.injector,
      wsPath: opts.wsPath || 'ws://127.0.0.1:8000',
      layoutConfig: opts.layoutConfig as LayoutConfig,
    };

    this.connectionPath = opts.connectionPath || `${this.config.wsPath}/service`;
    this.initBaseProvider(opts);
    this.initFields();
    this.createBrowserModules();
  }

  public async start() {
    // await createClientConnection(this.injector, this.modules, this.connectionPath);
    await createClientConnection2(this.injector, this.modules, this.connectionPath);
    this.stateService.state = 'client_connected';
    await this.startContributions();
    this.stateService.state = 'started_contributions';
    this.registerEventListeners();
    this.stateService.state = 'ready';
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
    this.menuRegistry = this.injector.get(MenuModelRegistry);
    this.stateService = this.injector.get(ClientAppStateService);
  }

  private createBrowserModules() {
    const injector = this.injector;
    for (const Constructor of this.modules) {
      const instance = injector.get(Constructor);
      this.browserModules.push(instance);

      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }
    }

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
    for (const contribution of this.contributions) {
      if (contribution.initialize) {
        try {
          await this.measure(contribution.constructor.name + '.initialize',
            () => contribution.initialize!(this),
          );
        } catch (error) {
          this.logger.error('Could not initialize contribution', error);
        }
      }
    }

    this.commandRegistry.onStart();
    this.keybindingRegistry.onStart();
    this.menuRegistry.onStart();

    for (const contribution of this.contributions) {
      if (contribution.onStart) {
        try {
          await this.measure(contribution.constructor.name + '.onStart',
            () => contribution.onStart!(this),
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
    for (const contribution of this.contributions) {
      if (contribution.onWillStop) {
        if (!!contribution.onWillStop(this)) {
          return true;
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

  /**
   * 注册全局事件监听
   */
  protected registerEventListeners(): void {
    window.addEventListener('beforeunload', (event) => {
      // 浏览器关闭事件前
      if (this.preventStop()) {
        event.returnValue = '';
        event.preventDefault();
        return '';
      }
    });
    window.addEventListener('unload', () => {
      // 浏览器关闭事件
      this.stateService.state = 'closing_window';
      this.stopContributions();
    });
    window.addEventListener('resize', () => {
      // 浏览器resize事件
    });
    document.addEventListener('keydown', (event) => {
      this.keybindingService.run(event);
    }, true);

    if (isOSX) {
      document.body.addEventListener('wheel', (event) => {
        // 屏蔽在OSX系统浏览器中由于滚动导致的前进后退事件
      }, { passive: false });
    }
  }
}
