import { Autowired, Injectable } from '@opensumi/di';

import { AppConfig, getTreeSitterWasmCDNUri } from '../../react-providers/config-provider';

import { type ESupportRuntime, onigWasmCDNUri } from './constants';

import type { BrowserModule } from '../../browser-module';
import type { Injector } from '@opensumi/di';

export enum EKnownResources {
  OnigWasm = 'wasm:onig',
  TreeSitterWasmDirectory = 'wasm:tree-sitter',
}

@Injectable()
export abstract class RendererRuntime {
  @Autowired(AppConfig)
  protected appConfig: AppConfig;

  abstract runtimeName: ESupportRuntime;

  abstract registerRuntimeInnerProviders(injector: Injector): void;
  abstract registerRuntimeModuleProviders(injector: Injector, module: BrowserModule): void;

  mergeAppConfig(meta: AppConfig): AppConfig {
    return meta;
  }

  async provideResourceUri(resource: string): Promise<string> {
    switch (resource) {
      case EKnownResources.OnigWasm:
        return this.appConfig.onigWasmUri || onigWasmCDNUri;
      case EKnownResources.TreeSitterWasmDirectory:
        return this.appConfig.treeSitterWasmDirectoryUri || getTreeSitterWasmCDNUri(this.appConfig.componentCDNType);
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}
