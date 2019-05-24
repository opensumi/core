import { Injector, ConstructorOf } from '@ali/common-di';
import { BrowserModule, IRootApp } from '../browser-module';
import { AppConfig, SlotMap, SlotRegistry } from '../react-providers';
import { innerProviders } from './inner-providers';
import { CommandRegistry, CommandService, CommandContribution } from '@ali/ide-core-common';

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

  config: AppConfig;

  slotMap: SlotMap;

  contributionCls = new Set<ConstructorOf<CommandContribution>>();

  constructor(opts: IRootAppOpts) {
    this.injector = opts.injector || new Injector();
    this.slotMap = opts.slotMap || new Map();
    this.slotRegistry = this.injector.get(SlotRegistry, [ this.slotMap ]);

    this.config = {
      workspaceDir: opts.workspaceDir || '',
      injector: this.injector,
      slotMap: this.slotMap,
    };

    this.injector.addProviders(...innerProviders);
    this.injector.addProviders({ token: IRootApp, useValue: this });
    this.injector.addProviders({ token: AppConfig, useValue: this.config });
    this.commandRegistry = this.injector.get(CommandService);

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

      if (instance.contributionsCls) {
        for (const cls of instance.contributionsCls) {
          this.contributionCls.add(cls);
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

  /**
   * 拿到 module 显示声明的 contributions，统一注册给 commandRegistry 上
   */
  private startContributions() {
    const instances = [...this.contributionCls].map((cls) => this.injector.get(cls));
    this.commandRegistry.onStart(instances);
  }
}
