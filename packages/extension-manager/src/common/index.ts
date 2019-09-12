export const MARKETPLACE = 'http://marketplace-afx-3780.gz00b.dev.alipay.net';

export const DEFAULT_ICON_URL = 'https://gw.alipayobjects.com/mdn/rms_883dd2/afts/img/A*TKtCQIToMwgAAAAAAAAAAABkARQnAQ';

export const enableExtensionsContainerId = 'extensions';
export const enableExtensionsTarbarHandlerId = 'extensions.enable';
export const disableExtensionsTarbarHandlerId = 'extensions.disable';
export const searchExtensionsTarbarHandlerId = 'extensions.search';

export const EXTENSION_SCHEME = 'extension';

export enum SearchState {
  LOADING,
  LOADED,
  NO_CONTENT,
}

// 插件面板左侧显示
export interface RawExtension {
  id: string; // publisher.name 或者 插件市场 extensionId
  showId: string; // publisher.name
  name: string;
  displayName: string;
  version: string;
  description: string;
  publisher: string;
  installed: boolean;
  icon: string;
  path: string;
  enable: boolean;
  isBuiltin: boolean;
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
  contributes: {
    [name: string]: any;
  };
}

export const ExtensionManagerServerPath = 'ExtensionManagerServerPath';

// 插件市场前端服务
export const IExtensionManagerService = Symbol('IExtensionManagerService');
export interface IExtensionManagerService {
  loading: boolean;
  enableResults: RawExtension[];
  disableResults: RawExtension[];
  searchResults: RawExtension[];
  searchState: SearchState;
  init(): Promise<void>;
  getDetailById(extensionId: string): Promise<ExtensionDetail | undefined>;
  getDetailFromMarketplace(extensionId: string): Promise<ExtensionDetail | undefined>;
  getRawExtensionById(extensionId: string): Promise<RawExtension>;
  toggleActiveExtension(extensionId: string, active: boolean): Promise<void>;
  search(query: string): void;
  downloadExtension(extensionId: string): Promise<string>;
  uninstallExtension(extensionPath: string): Promise<boolean>;
}

export const IExtensionManagerServer = Symbol('IExtensionManagerServer');
export interface IExtensionManagerServer {
  search(query: string): Promise<any>;
  getExtensionFromMarketPlace(extensionId: string): Promise<any>;
  downloadExtension(extensionId: string): Promise<string>;
  request(path: string): Promise<any>;
  requestExtension(extensionId: string): Promise<urllib.HttpClientResponse<NodeJS.ReadWriteStream>>;
  uninstallExtension(extensionPath: string): Promise<boolean>;
}
