import type { ESupportRuntime } from './constants';
import type { BrowserModule } from '../../browser-module';
import type { AppConfig } from '../../react-providers/config-provider';
import type { Injector } from '@opensumi/di';

export interface IRendererRuntime {
  runtimeName: ESupportRuntime;

  mergeAppConfig(meta: AppConfig): AppConfig;
  registerRuntimeInnerProviders(injector: Injector): void;
  registerRuntimeModuleProviders(injector: Injector, module: BrowserModule): void;
}
