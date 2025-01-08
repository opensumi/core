import { Injectable, Injector } from '@opensumi/di';

import { BrowserModule } from '../../../browser-module';
import { AppConfig, getTreeSitterWasmCDNUri } from '../../../react-providers';
import { electronEnv } from '../../../utils/electron';
import { ESupportRuntime, onigWasmCDNUri } from '../constants';
import { EKnownResources, RendererRuntime } from '../types';

import { injectElectronInnerProviders } from './inner-providers-electron';

@Injectable()
export class ElectronRendererRuntime extends RendererRuntime {
  runtimeName = ESupportRuntime.Electron;

  registerRuntimeModuleProviders(injector: Injector, instance: BrowserModule<any>): void {
    instance.electronProviders && injector.addProviders(...instance.electronProviders);
  }
  registerRuntimeInnerProviders(injector: Injector): void {
    injectElectronInnerProviders(injector);
  }

  override mergeAppConfig(meta: AppConfig): AppConfig {
    return mergeElectronMetadata(meta);
  }

  override async provideResourceUri(resource: EKnownResources): Promise<string> {
    switch (resource) {
      case EKnownResources.OnigWasm:
        return electronEnv.onigWasmUri || this.appConfig.onigWasmUri || onigWasmCDNUri;
      case EKnownResources.TreeSitterWasmDirectory:
        return (
          electronEnv.treeSitterWasmDirectoryUri ||
          this.appConfig.treeSitterWasmDirectoryUri ||
          getTreeSitterWasmCDNUri(this.appConfig.componentCDNType)
        );
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
}

function mergeElectronMetadata(config: AppConfig): AppConfig {
  const metadata = electronEnv.metadata ?? {};
  const newConfig = {
    ...config,
    appRoot: config.appRoot || electronEnv.appPath,
    extensionDir: config.extensionDir || metadata.extensionDir,
  };

  if (metadata.extensionDevelopmentHost) {
    config.extensionDevelopmentHost = metadata.extensionDevelopmentHost;
  }

  // 旧方案兼容, 把 `electron.metadata.extensionCandidate` 提前注入 `AppConfig` 的对应配置中
  if (metadata.extensionCandidate) {
    config.extensionCandidate = (config.extensionCandidate || []).concat(electronEnv.metadata.extensionCandidate || []);
  }

  return newConfig;
}
