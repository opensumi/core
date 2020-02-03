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
  container: HTMLElement;
}

export abstract class BrowserModule<T = any> extends BasicModule {
  @Autowired(IClientApp)
  protected app: IClientApp;
  public component?: React.FunctionComponent<T>;
  public preferences?: (inject: Injector) => void;
  // 脱离于layout渲染的模块
  public isOverlay?: boolean;
}
