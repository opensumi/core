import { Injectable, Injector } from '@opensumi/di';

import { BrowserModule } from '../../../browser-module';
import { AppConfig } from '../../../react-providers';
import { IRendererRuntime } from '../types';

import { injectBrowserInnerProviders } from './inner-providers-browser';

@Injectable()
export class BrowserRuntime implements IRendererRuntime {
  registerRuntimeModuleProviders(injector: Injector, instance: BrowserModule<any>): void {
    instance.webProviders && injector.addProviders(...instance.webProviders);
  }
  registerRuntimeInnerProviders(injector: Injector): void {
    injectBrowserInnerProviders(injector);
  }
  mergeAppConfig(meta: AppConfig): AppConfig {
    return meta;
  }
}
