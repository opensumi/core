import { URI, IDisposable, Event } from '@opensumi/ide-core-common';

import { PreferenceProvider } from './preference-provider';
import { PreferenceScope } from './preference-scope';

export interface PreferenceChange {
  readonly preferenceName: string;
  readonly newValue?: any;
  readonly oldValue?: any;
  readonly scope: PreferenceScope;
  affects(resourceUri?: string): boolean;
}

export interface PreferenceResolveResult<T> {
  configUri?: URI;
  value?: T;
  scope?: PreferenceScope;
  // 是否存在来自针对语言的设置
  languageSpecific?: boolean;
}

export interface PreferenceChanges {
  [preferenceName: string]: PreferenceChange;
}
export const PreferenceService = Symbol('PreferenceService');

export interface PreferenceService extends IDisposable {
  readonly ready: Promise<void>;
  /**
   * 获取一个配置的值
   * @param preferenceName  配置名称
   * @param defaultValue 默认值
   * @param resourceUri 资源路径
   * @param overrideIdentifier 一般指语言偏好设置
   */
  get<T>(preferenceName: string, defaultValue: T, resourceUri?: string, overrideIdentifier?: string): T;
  get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string, overrideIdentifier?: string): T | undefined;

  /**
   * 是否一个配置在指定 scope 存在针对语言的配置
   * @param preferenceName 配置名称
   * @param overrideIdentifier 语言
   * @param resourceUri 资源路径
   */
  hasLanguageSpecific(preferenceName: any, overrideIdentifier: string, resourceUri: string): boolean;

  /**
   * 设置一个配置的值
   * @param preferenceName 偏好名称
   * @param value 设置值
   * @param scope 目标scope级别 如 User, Workspace
   * @param resourceUri 资源路径
   * @param overrideIdentifier 一般指语言偏好设置
   */
  set(
    preferenceName: string,
    value: any,
    scope?: PreferenceScope,
    resourceUri?: string,
    overrideIdentifier?: string,
  ): Promise<void>;

  onPreferenceChanged: Event<PreferenceChange>;

  onPreferencesChanged: Event<PreferenceChanges>;

  onLanguagePreferencesChanged: Event<{ overrideIdentifier: string; changes: PreferenceChanges }>;

  inspect<T>(
    preferenceName: string,
    resourceUri?: string,
    language?: string,
  ):
    | {
        preferenceName: string;
        defaultValue: T | undefined;
        globalValue: T | undefined; // User Preference
        workspaceValue: T | undefined; // Workspace Preference
        workspaceFolderValue: T | undefined; // Folder Preference
      }
    | undefined;

  getProvider(scope: PreferenceScope): PreferenceProvider | undefined;

  resolve<T>(
    preferenceName: string,
    defaultValue?: T,
    resourceUri?: string,
    language?: string,
    untilScope?: PreferenceScope,
  ): PreferenceResolveResult<T>;

  /**
   * 都走 onPreferenceChanged 再用if判断性能太差了
   * TODO: 将只监听一个偏好的使用这个方法
   * @param preferenceName
   */
  onSpecificPreferenceChange(preferenceName, listener: (change: PreferenceChange) => void): IDisposable;
}

export const PreferenceProviderProvider = Symbol('PreferenceProviderProvider');
export type PreferenceProviderProvider = (scope: PreferenceScope, uri?: URI) => PreferenceProvider;
