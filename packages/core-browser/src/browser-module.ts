import { Injector, Autowired } from '@opensumi/di';
import { BasicModule, CommandRegistry, Deferred } from '@opensumi/ide-core-common';

import { AppConfig } from './react-providers';

export const IClientApp = Symbol('CLIENT_APP_TOKEN');

export interface IClientApp {
  appInitialized: Deferred<void>;
  browserModules: BrowserModule<any>[];
  injector: Injector;
  config: AppConfig;
  commandRegistry: CommandRegistry;
  fireOnReload: (forcedReload?: boolean) => void;
}

export abstract class BrowserModule<T = any> extends BasicModule {
  @Autowired(IClientApp)
  protected app: IClientApp;
  public component?: React.ComponentType<T>;
  public preferences?: (inject: Injector) => void;
  // 脱离于layout渲染的模块
  public isOverlay?: boolean;
}
