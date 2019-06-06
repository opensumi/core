import { Injector, ConstructorOf } from '@ali/common-di';
import { BrowserModule, IClientApp } from '../browser-module';
import { AppConfig, SlotMap, SlotRegistry } from '../react-providers';
import { injectInnerProviders } from './inner-providers';
import { KeybindingRegistry, KeybindingService } from '../keybinding';
import { CommandRegistry, MenuModelRegistry, isOSX, ContributionProvider, getLogger, ILogger, MaybePromise } from '@ali/ide-core-common';
import { ClientAppStateService } from '../services/clientapp-status-service';
import { createClientConnection } from './connection';

export type ModuleConstructor = ConstructorOf<BrowserModule>;
export type ContributionConstructor = ConstructorOf<ClientAppContribution>;

export interface IClientAppOpts extends Partial<AppConfig> {
  modules: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: BrowserModule[];
  connectionPath?: string;
}

export const ClientAppContribution = Symbol('ClientAppContribution');

export const ClientAppContributionProvider = Symbol('ClientAppContributionProvider');

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

  slotMap: SlotMap;

  contributions: ContributionProvider<ClientAppContribution>;

  slotRegistry: SlotRegistry;

  commandRegistry: CommandRegistry;

  menuRegistry: MenuModelRegistry;

  stateService: ClientAppStateService;

  constructor(opts: IClientAppOpts) {
    this.injector = opts.injector || new Injector();
    this.slotMap = opts.slotMap || new Map();
    this.slotRegistry = this.injector.get(SlotRegistry, [this.slotMap]);
    this.modules = opts.modules;

    this.connectionPath = opts.connectionPath || 'ws://127.0.0.1:8000/service';
    this.config = {
      workspaceDir: opts.workspaceDir || '',
      injector: this.injector,
      slotMap: this.slotMap,
    };
    this.initBaseProvider(opts);
    this.initInstances();
    this.createBrowserModules(opts.modules, opts.modulesInstances || []);
  }

  public async start() {
    await createClientConnection(this.injector, this.modules, this.connectionPath);
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
    if (opts.contributions) {
      // 将外部传入的 Client Contribution 传入 DI
      this.injector.addProviders(...opts.contributions);
    }
    injectInnerProviders(this.injector);
  }

  /**
   * 从 injector 里获得实例
   */
  private initInstances() {
    this.contributions = this.injector.get(ClientAppContributionProvider);
    this.commandRegistry = this.injector.get(CommandRegistry);
    this.keybindingRegistry = this.injector.get(KeybindingRegistry);
    this.keybindingService = this.injector.get(KeybindingService);
    this.menuRegistry = this.injector.get(MenuModelRegistry);
    this.stateService = this.injector.get(ClientAppStateService);
  }

  private createBrowserModules(
    Constructors: ModuleConstructor[],
    modules: BrowserModule[],
  ) {
    const allModules = [...modules];
    const injector = this.injector;
    for (const Constructor of Constructors) {
      const instance = injector.get(Constructor);
      allModules.push(instance);

      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }
    }

    for (const instance of allModules) {
      this.browserModules.push(instance);

      if (instance.slotMap) {
        for (const [location, component] of instance.slotMap.entries()) {
          this.slotRegistry.register(location, component);
        }
      }
    }
  }

  protected async startContributions() {
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.initialize) {
        try {
          await contribution.initialize(this);
        } catch (error) {
          this.logger.error('Could not initialize contribution', error);
        }
      }
    }

    this.commandRegistry.onStart();
    this.keybindingRegistry.onStart();
    this.menuRegistry.onStart();

    for (const contribution of this.contributions.getContributions()) {
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
    for (const contribution of this.contributions.getContributions()) {
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
    for (const contribution of this.contributions.getContributions()) {
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
