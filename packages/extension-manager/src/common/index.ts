// import { ExtraMetaData, IExtensionMetaData } from '@ali/ide-kaitian-extension/lib/common';

export const tarbarHandlerId = 'extensions';

export const EXTENSION_SCHEME = 'extension';

// 插件面板左侧显示
export interface RawExtension {
  id: string; // publisher.name
  name: string;
  displayName: string;
  version: string;
  description: string;
  publisher: string;
  installed: boolean;
  icon: string;
  path: string;
  engines: {
    vscode: string,
    kaitian: string,
  };
}

// 插件详情页显示
export interface ExtensionDetail extends RawExtension {
  readme: string;
  changelog: string;
  license: string;
  categories: string;
  enable: boolean;
  contributes: {
    [name: string]: any;
  };
}

export const ExtensionManagerServerPath = 'ExtensionManagerServerPath';

// 插件市场前端服务
export const IExtensionManagerService = Symbol('IExtensionManagerService');
export interface IExtensionManagerService {
  loading: boolean;
  installed: RawExtension[];
  init(): Promise<void>;
  getDetailById(extensionId: string): Promise<ExtensionDetail | undefined>;
  getRawExtensionById(extensionId: string): Promise<RawExtension>;
  toggleActiveExtension(extensionId: string, active: boolean): Promise<void>;
}

export const IExtensionManagerServer = Symbol('IExtensionManagerServer');
export interface IExtensionManagerServer {
  search(query: string): Promise<RawExtension[]>;
}
