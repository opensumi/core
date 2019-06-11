import { BasicModule, CommandRegistry, CommandContribution } from '@ali/ide-core-common';
import { SlotRegistry, AppConfig, SlotMap } from './react-providers';
import { Injector, Autowired, Provider, ConstructorOf } from '@ali/common-di';

export const IClientApp = Symbol('CLIENT_APP_TOKEN');

export interface IClientApp {
  browserModules: BrowserModule[];
  injector: Injector;
  config: AppConfig;
  slotRegistry: SlotRegistry;
  commandRegistry: CommandRegistry;
}

export abstract class BrowserModule extends BasicModule {
  slotMap: SlotMap;
  @Autowired(IClientApp)
  protected app: IClientApp;
}
