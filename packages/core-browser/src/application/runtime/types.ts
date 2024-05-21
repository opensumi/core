import { Autowired, Injectable } from '@opensumi/di';

import { AppConfig, IStaticResourceProvider } from '../../react-providers/config-provider';

import { type ESupportRuntime, onigWasmCDNUri, treeSitterWasmCDNUri } from './constants';

import type { BrowserModule } from '../../browser-module';
import type { Injector } from '@opensumi/di';

export enum EKnownResources {
  OnigWasm = 'wasm:onig',
  TreeSitterWasmDirectory = 'wasm:tree-sitter',
}

@Injectable()
export abstract class IRendererRuntime implements Required<IStaticResourceProvider> {
  @Autowired(AppConfig)
  appConfig: AppConfig;

  abstract runtimeName: ESupportRuntime;

  abstract registerRuntimeInnerProviders(injector: Injector): void;
  abstract registerRuntimeModuleProviders(injector: Injector, module: BrowserModule): void;

  provideMonacoWorkerUrl(workerId: string, label: string): string {
    if (this.appConfig.resourceProvider && this.appConfig.resourceProvider.provideMonacoWorkerUrl) {
      return this.appConfig.resourceProvider!.provideMonacoWorkerUrl!(workerId, label);
    }

    throw new Error('MonacoEnvironment.getWorkerUrl is not implemented, which might cause UI freezes.');
  }

  mergeAppConfig(meta: AppConfig): AppConfig {
    return meta;
  }

  async provideResourceUri(resource: string): Promise<string> {
    switch (resource) {
      case EKnownResources.OnigWasm:
        return this.appConfig.onigWasmUri || onigWasmCDNUri;
      case EKnownResources.TreeSitterWasmDirectory:
        return this.appConfig.treeSitterWasmDirectoryUri || treeSitterWasmCDNUri;
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}
