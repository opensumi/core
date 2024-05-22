import { Injectable, Injector } from '@opensumi/di';

import { BrowserModule } from '../../../browser-module';
import { ESupportRuntime } from '../constants';
import { RendererRuntime } from '../types';

import { injectBrowserInnerProviders } from './inner-providers-browser';

@Injectable()
export class BrowserRuntime extends RendererRuntime {
  runtimeName = ESupportRuntime.Web;

  registerRuntimeModuleProviders(injector: Injector, instance: BrowserModule<any>): void {
    instance.webProviders && injector.addProviders(...instance.webProviders);
  }
  registerRuntimeInnerProviders(injector: Injector): void {
    injectBrowserInnerProviders(injector);
  }
}
