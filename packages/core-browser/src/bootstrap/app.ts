import { Injector, ConstructorOf } from '@ali/common-di';
import { BrowserModule, IRootApp } from '../browser-module';
import { AppConfig, SlotMap, SlotRegistry } from '../react-providers';
import { injectInnerProviders } from './inner-providers';
import { CommandRegistry, MenuModelRegistry, isOSX } from '@ali/ide-core-common';
import { KeybindingRegistry, KeybindingService } from '../keybinding';

export type ModuleConstructor = ConstructorOf<BrowserModule>;

export interface IRootAppOpts extends Partial<AppConfig> {
  modules: ModuleConstructor[];
  modulesInstances?: BrowserModule[];
}

export class RootApp implements IRootApp {
  browserModules: BrowserModule[] = [];

  injector: Injector;

  slotRegistry: SlotRegistry;

  commandRegistry: CommandRegistry;
  menuRegistry: MenuModelRegistry;

  keybindingRegistry: KeybindingRegistry;

  keybindingService: KeybindingService;

  config: AppConfig;

  slotMap: SlotMap;

  constructor(opts: IRootAppOpts) {
    this.injector = opts.injector || new Injector();
    this.slotMap = opts.slotMap || new Map();
    this.slotRegistry = this.injector.get(SlotRegistry, [this.slotMap]);

    this.config = {
      workspaceDir: opts.workspaceDir || '',
      injector: this.injector,
      slotMap: this.slotMap,
    };
    // 给 injector 初始化默认的 Providers
    injectInnerProviders(this.injector);
    this.injector.addProviders({ token: IRootApp, useValue: this });
    this.injector.addProviders({ token: AppConfig, useValue: this.config });
    this.commandRegistry = this.injector.get(CommandRegistry);

    this.keybindingRegistry = this.injector.get(KeybindingRegistry);
    this.keybindingService = this.injector.get(KeybindingService);
    this.menuRegistry = this.injector.get(MenuModelRegistry);

    this.createBrowserModules(opts.modules, opts.modulesInstances || []);
    this.startContributions();
    this.activeAllModules();
    this.registerEventListeners();
  }

  private createBrowserModules(
    Constructors: ModuleConstructor[],
    modules: BrowserModule[],
  ) {
    const allModules = [...modules];
    const injector = this.injector;
    for (const Constructor of Constructors) {
      allModules.push(injector.get(Constructor));
    }

    for (const instance of allModules) {
      this.browserModules.push(instance);

      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }

      if (instance.slotMap) {
        for (const [location, component] of instance.slotMap.entries()) {
          this.slotRegistry.register(location, component);
        }
      }
    }
  }

  private activeAllModules() {
    for (const item of this.browserModules) {
      if (item.active) {
        item.active();
      }
    }
  }

  private startContributions() {
    this.commandRegistry.onStart();
    this.keybindingRegistry.onStart();
    this.menuRegistry.onStart();
  }

  /**
   * 注册全局事件监听
   */
  protected registerEventListeners(): void {
    window.addEventListener('beforeunload', (event) => {
      // 浏览器关闭事件前
    });
    window.addEventListener('unload', () => {
      // 浏览器关闭事件
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
