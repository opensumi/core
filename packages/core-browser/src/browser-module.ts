import { BasicModule, CommandRegistry, Event } from '@ali/ide-core-common';
import { AppConfig } from './react-providers';
import { Injector, Autowired, Provider, ConstructorOf } from '@ali/common-di';

export const IClientApp = Symbol('CLIENT_APP_TOKEN');

export interface IClientApp {
  browserModules: BrowserModule<any>[];
  injector: Injector;
  config: AppConfig;
  commandRegistry: CommandRegistry;
  fireOnReload: (forcedReload?: boolean) => void;
}

export abstract class BrowserModule<T = any> extends BasicModule {
  @Autowired(IClientApp)
  protected app: IClientApp;
  component?: React.FunctionComponent<T>;
  preferences?: (inject: Injector) => void;
  iconClass?: string;
  title?: string;
}
