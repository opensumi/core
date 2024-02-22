import type { Injector } from '@opensumi/di';

import type { BrowserModule } from '../browser-module';
import type { AppConfig } from '../react-providers/config-provider';

export interface IRendererRuntime {
  mergeAppConfig(meta: AppConfig): AppConfig;
  registerRuntimeInnerProviders(injector: Injector): void;
  registerRuntimeModuleProviders(injector: Injector, module: BrowserModule): void;
}
