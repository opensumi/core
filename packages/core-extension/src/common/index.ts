import { Injectable } from '@ali/common-di';

export const CoreExtensionNodeServiceServerPath = 'CoreExtensionNodeService';

@Injectable()
export abstract class CoreExtensionNodeService {
  abstract async getExtensions(scan: string[], candidate: string[], extraMetaData: {[key: string]: string; }): Promise<ICoreExtension[]>;
}

export interface ICoreExtension {

  name: string;

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
