import { Injectable, Injector } from '@opensumi/di';

import { BrowserModule } from '../../browser-module';
import { AppConfig } from '../../react-providers';
import { electronEnv } from '../../utils/electron';
import { IRendererRuntime } from '../types';

import { injectElectronInnerProviders } from './inner-providers-electron';

@Injectable()
export class ElectronRendererRuntime implements IRendererRuntime {
  registerRuntimeModuleProviders(injector: Injector, instance: BrowserModule<any>): void {
    instance.electronProviders && injector.addProviders(...instance.electronProviders);
  }
  registerRuntimeInnerProviders(injector: Injector): void {
    injectElectronInnerProviders(injector);
  }
  mergeAppConfig(meta: AppConfig): AppConfig {
    return mergeElectronMetadata(meta);
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
