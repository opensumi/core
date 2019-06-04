import { Injector, ConstructorOf } from '@ali/common-di';
import { BrowserModule, IRootApp } from '../browser-module';
import { AppConfig, SlotMap, SlotRegistry } from '../react-providers';
import { injectInnerProviders } from './inner-providers';
import { CommandRegistry } from '@ali/ide-core-common';
import { MenuModelRegistry } from '@ali/ide-core-common/lib/menu';

export type ModuleConstructor = ConstructorOf<BrowserModule>;

export interface IRootAppOpts extends Partial<AppConfig>  {
  modules: ModuleConstructor[];
  modulesInstances?: BrowserModule[];
}

export class RootApp implements IRootApp {
  browserModules: BrowserModule[] = [];

  injector: Injector;

  slotRegistry: SlotRegistry;

  commandRegistry: CommandRegistry;
  menuRegistry: MenuModelRegistry;

  config: AppConfig;

  slotMap: SlotMap;

  constructor(opts: IRootAppOpts) {
    this.injector = opts.injector || new Injector();
    this.slotMap = opts.slotMap || new Map();
    this.slotRegistry = this.injector.get(SlotRegistry, [ this.slotMap ]);

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
    this.menuRegistry = this.injector.get(MenuModelRegistry);

    this.createBrowserModules(opts.modules, opts.modulesInstances || []);
    this.startContributions();
    this.activeAllModules();
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
    this.menuRegistry.onStart();
  }
}
