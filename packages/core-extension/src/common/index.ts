import { Injectable, Provider } from '@ali/common-di';

export const CoreExtensionNodeServiceServerPath = 'CoreExtensionNodeService';

@Injectable()
export abstract class CoreExtensionNodeService {
  abstract async getExtensions(): Promise<ICoreExtension[]>;
}

export interface ICoreExtension {

  name: string;

  path: string;

  browser?: ICoreExtensionBrowserConfig;

  node?: ICoreExtensionNodeConfig;

  platform: Array<'web' | 'electron'>;

  enabled: boolean;

  electron?: ICoreExtensionElectronConfig;
}

export interface ICoreExtensionBrowserConfig {

  entry: string;

  style?: string;

}

export interface ICoreExtensionNodeConfig {

  entry: string;

}

export interface ICoreExtensionElectronConfig {

  nodeIntegrated: boolean;

  main?: string;

}

export interface ICoreExtensionBrowserContribution {

  getProviders(): Provider[];

  useBackServices(): any[];

}

export interface ICoreExtensionNodeContribution {

  getProviders(): Provider[];

  provideBackServices(): any[];
}

export const CORE_BROWSER_REQUIRE_NAME = 'kaitian';
export const CORE_NODE_REQUIRE_NAME = 'kaitian-node';
