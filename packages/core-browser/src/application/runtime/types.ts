import type { ESupportRuntime } from './constants';
import type { BrowserModule } from '../../browser-module';
import type { AppConfig } from '../../react-providers/config-provider';
import type { Injector } from '@opensumi/di';

export enum EKnownResources {
  OnigWasm = 'wasm:onig',
  TreeSitterWasmDirectory = 'wasm:tree-sitter',
}

export const IRendererRuntime = Symbol('IRendererRuntime');
export interface IRendererRuntime {
  runtimeName: ESupportRuntime;

  mergeAppConfig(meta: AppConfig): AppConfig;
  registerRuntimeInnerProviders(injector: Injector): void;
  registerRuntimeModuleProviders(injector: Injector, module: BrowserModule): void;

  provideResourceUri(resource: EKnownResources): Promise<string>;
}
