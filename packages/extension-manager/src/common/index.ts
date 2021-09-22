import { IMenu } from '@ali/ide-core-browser/lib/menu/next';
import { BasicEvent, IExtensionProps } from '@ali/ide-core-common';
import { ExtensionDependencies, IExtraMetaData } from '@ali/ide-kaitian-extension/lib/common';

export const EXTENSION_DIR = 'extension/';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

// IExtensionProps 属性为 readonly，改为 writeable
export type IExtension = Writeable<IExtensionProps> & {
  enableScope: EnableScope,
  reloadRequire?: boolean;
  installed: boolean;
  newVersion?: string;
};

export enum EnableScope {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE',
}

export enum TabActiveKey {
  MARKETPLACE = 'marketplace',
  INSTALLED = 'installed',
}

export interface ExtensionMomentState {
  isInstalling?: boolean;
  isUpdating?: boolean;
  isUnInstalling?: boolean;
}

export const SearchFromMarketplaceCommandId = 'SearchFromMarketplaceCommand';

export const DEFAULT_ICON_URL = 'https://gw.alipayobjects.com/mdn/rms_d8fa74/afts/img/A*upJXQo96It8AAAAAAAAAAABkARQnAQ';

export const PREFIX = '/openapi/ide/';
export const enableExtensionsContainerId = 'extensions';
export const hotExtensionsContainerId = 'hot-extensions';
export const enableExtensionsTarbarHandlerId = 'extensions.enable';
export const disableExtensionsTarbarHandlerId = 'extensions.disable';
export const searchExtensionsFromInstalledTarbarHandlerId = 'extensions.installed.search';
export const searchExtensionsFromMarketplaceTarbarHandlerId = 'extensions.marketplace.search';
export const hotExtensionsFromMarketplaceTarbarHandlerId = 'extensions.marketplace.hot';

export const EXTENSION_SCHEME = 'extension';

export enum SearchState {
  LOADING,
  LOADED,
  NO_CONTENT,
  NO_MORE,
}

/**
 * 从插件市场过来的搜索结果
 */
export interface SearchExtension {
  extensionId: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  version: string;
  downloadCount: number;
  publisher: string;
  displayGroupName?: string;
}

// 最小单元的插件信息
export interface BaseExtension {
  extensionId: string; // 插件市场 extensionId
  name: string;
  version: string;
  path: string;
  publisher: string;
  isBuiltin?: boolean;
}

// 插件面板左侧显示
export interface RawExtension extends BaseExtension {
  id: string; // publisher.name
  displayName: string;
  description: string;
  installed: boolean;
  icon: string;
  enable: boolean;
  isBuiltin: boolean;
  isDevelopment?: boolean;
  downloadCount?: number;
  reloadRequire?: boolean;
  // 启用范围
  enableScope: EnableScope;
  engines: {
    vscode: string,
    kaitian: string,
  };
  displayGroupName?: string;
  newVersion?: string;
}

// 插件详情页显示
export interface ExtensionDetail extends RawExtension {
  readme: string;
  changelog: string;
  license: string;
  categories: string;
  packageJSON: any;
  // 代码仓库
  repository: string;
  contributes: {
    [name: string]: any;
  };
}

export const ExtensionManagerServerPath = 'ExtensionManagerServerPath';

export const IExtensionManager = Symbol('IExtensionManager');
export interface IExtensionManager {
  installExtension(extension: BaseExtension, version?: string): Promise<string | string[]>;
  updateExtension(extension: BaseExtension, version: string): Promise<string | string[]>;
  uninstallExtension(extension: BaseExtension): Promise<boolean>;
}

// 插件市场前端服务
export const IExtensionManagerService = Symbol('IExtensionManagerService');
export interface IExtensionManagerService  {
  isInit: boolean;
  loading: SearchState;
  hotExtensions: RawExtension[];
  enableResults: RawExtension[];
  marketplaceQuery: string;
  installedQuery: string;
  tabActiveKey: TabActiveKey;
  disableResults: RawExtension[];
  searchInstalledState: SearchState;
  searchInstalledResults: RawExtension[];
  searchMarketplaceState: SearchState;
  searchMarketplaceResults: RawExtension[];
  contextMenu: IMenu;
  marketplaceNoResultsContext: IMenu;
  extensionMomentState: Map<string, ExtensionMomentState>;
  installedIds: string[];
  useEnabledIds: string[];
  bindEvents(): void;
  init(): Promise<void>;
  getDetailById(extensionId: string): Promise<ExtensionDetail | undefined>;
  getDetailFromMarketplace(extensionId: string, version?: string): Promise<ExtensionDetail | undefined>;
  getRawExtensionById(extensionId: string): RawExtension | undefined;
  toggleActiveExtension(extension: BaseExtension, active: boolean, scope: EnableScope): Promise<void>;
  searchFromMarketplace(query: string): void;
  searchFromInstalled(query: string): void;
  onInstallExtension(extensionId: string, path: string): Promise<void>;
  onUpdateExtension(path: string, oldExtensionPath: string): Promise<void>;
  computeReloadState(extensionPath: string): Promise<boolean>;
  onDisableExtension(extensionPath: string): Promise<void>;
  onEnableExtension(extensionPath: string): Promise<void>;
  makeExtensionStatus(extensionId: string, state: Partial<RawExtension>): Promise<void>;
  setRequestHeaders(requestHeaders: RequestHeaders): Promise<void>;
  openExtensionDetail(options: OpenExtensionOptions): void;
  installExtensionByReleaseId(releaseId: string): Promise<string | string[]>;
  installExtension(extension: BaseExtension, version?: string): Promise<string | void | string[]>;
  updateExtension(extension: BaseExtension, version: string): Promise<string | string[]>;
  uninstallExtension(extension: BaseExtension): Promise<boolean>;
  loadHotExtensions(): Promise<void>;
  getExtDeps(extensionId: string, version?: string): Promise<ExtensionDependencies>;
  dispose(): void;
  getEnabledDepsByExtensionId(extensionId: string): string[];
  transformDepsDeclaration(raw: string | { [key: string]: string}): { id: string, version: string };
  getExtensionVersions(extensionId: string): Promise<IExtensionVersion[]>;
  checkNeedReload(extensionId: string, reloadRequire: boolean): Promise<void>;
  getExtensionsInPack(extensionId: string, version?: string): Promise<string[]>;
  enableAllExtensions(): Promise<void>;
  disableAllExtensions(): Promise<void>;
}

export const IExtensionManagerServer = Symbol('IExtensionManagerServer');

export interface IExtensionDependenciesResFromMarketPlace {
  data: {
    dependencies: ExtensionDependencies;
    version: string;
    id: string;
    extensionId: string;
  };
}

export interface IExtensionsInPackResFromMarketPlace {
  data: {
    version: string;
    id: string;
    identifier: string;
    extensionId: string;
    extensionPack: IExtraMetaData[];
  };
}

export interface IMarketplaceExtensionInfo {
  extensionId: string;
  identifier: string;
  downloadCount?: number;
  displayGroupName?: string;
}

export interface IExtensionManagerServer {
  search(query: string, ignoreId?: string[]): Promise<any>;
  getExtensionFromMarketPlace(extensionId: string, version?: string): Promise<any>;
  getExtensionsInfo(idList: string[]): Promise<IMarketplaceExtensionInfo[]>;
  getHotExtensions(ignoreId: string[], queryIndex: number): Promise<any>;
  isShowBuiltinExtensions(): boolean;
  setHeaders(headers: RequestHeaders): void;
  installExtensionByReleaseId(releaseId: string): Promise<string | string[]>;
  installExtension(extension: BaseExtension, version?: string): Promise<string | string[]>;
  updateExtension(extension: BaseExtension, version: string): Promise<string | string[]>;
  uninstallExtension(extension: BaseExtension): Promise<boolean>;
  getExtensionDeps(extensionId: string, version?: string): Promise<IExtensionDependenciesResFromMarketPlace | undefined>;
  getExtensionVersions(extensionId: string): Promise<IExtensionVersion[]>;
  getExtensionsInPack(extensionId: string, version?: string): Promise<IExtensionsInPackResFromMarketPlace>;
}

export interface IExtensionVersion {
  version: string;
  createdTime: string;
}

export interface RequestHeaders {
  [header: string]: string;
}

export const IExtensionManagerRequester = Symbol('IExtensionManagerRequester');

export interface IExtensionManagerRequester {
  request<T = any>(path: string, options?: urllib.RequestOptions): Promise<urllib.HttpClientResponse<T>>;
  setHeaders(headers: RequestHeaders): void;
  getHeaders(): RequestHeaders;
}

export interface OpenExtensionOptions {
  publisher: string;
  name: string;
  preview: boolean;
  remote: boolean;
  displayName?: string;
  version?: string;
  icon?: string;
}

export enum ExtensionChangeType {
  INSTALL,
  UNINSTALL,
  ENABLE,
  DISABLE,
}

export interface ExtensionChange {
  type: ExtensionChangeType;
  detail: BaseExtension;
}

export class ExtensionChangeEvent extends BasicEvent<ExtensionChange> {}
