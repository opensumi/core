import { BasicModule, CommandRegistry, CommandContribution } from '@ali/ide-core-common';
import { SlotRegistry, AppConfig, SlotMap } from './react-providers';
import { Injector, Autowired, Provider, ConstructorOf } from '@ali/common-di';

export const IRootApp = Symbol('ROOT_APP_TOKEN');

export interface IRootApp {
  browserModules: BrowserModule[];
  injector: Injector;
  config: AppConfig;
  slotRegistry: SlotRegistry;
  commandRegistry: CommandRegistry;
}

export abstract class BrowserModule extends BasicModule {
  providers?: Provider[];
  backServices?: any[];
  frontServices?: any[];
  slotMap: SlotMap;
  contributionsCls?: Array<ConstructorOf<CommandContribution>>;
  @Autowired(IRootApp)
  protected app: IRootApp;
  active?(): void;
}
