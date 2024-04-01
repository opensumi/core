import { Injectable, Injector } from '@opensumi/di';

import { BrowserModule } from '../../../browser-module';
import { AppConfig } from '../../../react-providers';
import { ESupportRuntime, onigWasmCDNUri, treeSitterWasmCDNUri } from '../constants';
import { EKnownResources, IRendererRuntime } from '../types';

import { injectBrowserInnerProviders } from './inner-providers-browser';

import type { ClientApp } from '../../../bootstrap/app';

@Injectable()
export class BrowserRuntime implements IRendererRuntime {
  runtimeName = ESupportRuntime.Web;

  constructor(private app: ClientApp) {}

  registerRuntimeModuleProviders(injector: Injector, instance: BrowserModule<any>): void {
    instance.webProviders && injector.addProviders(...instance.webProviders);
  }
  registerRuntimeInnerProviders(injector: Injector): void {
    injectBrowserInnerProviders(injector);
  }
  mergeAppConfig(meta: AppConfig): AppConfig {
    return meta;
  }

  async provideResourceUri(resource: EKnownResources): Promise<string> {
    switch (resource) {
      case EKnownResources.OnigWasm:
        return this.app.config.onigWasmUri || onigWasmCDNUri;
      case EKnownResources.TreeSitterWasmDirectory:
        return this.app.config.treeSitterWasmDirectoryUri || treeSitterWasmCDNUri;
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}
