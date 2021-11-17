import { QueryParam, QueryResult, VSXExtensionRaw, VSXSearchParam, VSXSearchResult } from './vsx-registry-types';

export enum EnableScope {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE',
}

export enum TabActiveKey {
  MARKETPLACE = 'marketplace',
  INSTALLED = 'installed',
}

export type VSXExtensionNamespaceAccess = 'public' | 'restricted';

/**
 * Should be aligned with https://github.com/eclipse/openvsx/blob/master/server/src/main/java/org/eclipse/openvsx/json/UserJson.java
 */
export interface VSXUser {
  loginName: string;
  homepage?: string;
}

export class VSXExtension {
  readonly version?: string;
  readonly iconUrl?: string;
  readonly publisher?: string;
  readonly name?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly namespace?: string;
  readonly averageRating?: number;
  readonly downloadCount?: number;
  readonly downloadUrl?: string;
  readonly readmeUrl?: string;
  readonly licenseUrl?: string;
  readonly repository?: string;
  readonly license?: string;
  readonly readme?: string;
  readonly url?: string;
  readonly preview?: boolean;
  readonly namespaceAccess?: VSXExtensionNamespaceAccess;
  readonly publishedBy?: VSXUser;
  static KEYS: Set<keyof VSXExtension> = new Set([
    'version',
    'iconUrl',
    'publisher',
    'name',
    'displayName',
    'description',
    'averageRating',
    'downloadCount',
    'downloadUrl',
    'readmeUrl',
    'licenseUrl',
    'repository',
    'license',
    'readme',
    'preview',
    'namespaceAccess',
    'publishedBy',
  ]);
}

export const VSXExtensionServiceToken = Symbol('VSXExtensionSerivceToken');

export interface IVSXExtensionService {
  search(keyword: string): Promise<void>;
  install(extension: VSXExtension): Promise<string | undefined>;
  getExtension(extensionId: string): Promise<VSXExtensionRaw | undefined>;
  openExtensionEditor(extensionId: string): Promise<void>;

  extensions: VSXExtension[];
}

export const VSXExtensionBackSerivceToken = Symbol('VSXExtensionBackSerivceToken');

export const VSXExtensionServicePath = 'VSXExtensionServicePath';

export interface IExtensionInstallParam {
  id: string;
  name: string;
  url: string;
  version: string;
}
export interface IVSXExtensionBackService {
  search(param?: VSXSearchParam): Promise<VSXSearchResult>;
  install(param: IExtensionInstallParam): Promise<string>;
  getExtension(param: QueryParam): Promise<QueryResult | undefined>;
}
