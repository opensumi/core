import { BasicModule, CommandRegistry, CommandContribution } from '@ali/ide-core-common';
import { AppConfig } from './react-providers';
import { Injector, Autowired, Provider, ConstructorOf } from '@ali/common-di';

export const IClientApp = Symbol('CLIENT_APP_TOKEN');

export interface IClientApp {
  browserModules: BrowserModule<any>[];
  injector: Injector;
  config: AppConfig;
  commandRegistry: CommandRegistry;
}

export abstract class BrowserModule<T = any> extends BasicModule {
  @Autowired(IClientApp)
  protected app: IClientApp;
  component?: React.FunctionComponent<T>;
  iconClass?: string;
  title?: string;
}
