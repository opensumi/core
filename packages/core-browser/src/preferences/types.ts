import { Event, IDisposable, URI } from '@opensumi/ide-core-common';

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
   * 查询是否有对应配置
   * @param {string} preferenceName
   * @param {string} [resourceUri]
   * @returns {boolean}
   */
  has(preferenceName: string, resourceUri?: string, language?: string): boolean;

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
   * 简单通过 `preferenceName` 获取到有效的配置值，防止异常数据导致逻辑问题
   * @param preferenceName 配置名称
   * @param defaultValue 默认值
   */
  getValid<T>(preferenceName: string, defaultValue: T): T;
  getValid<T>(preferenceName: string, defaultValue?: T): T | undefined;

  /**
   * 是否一个配置在指定 scope 存在针对语言的配置
   * @param preferenceName 配置名称
   * @param overrideIdentifier 语言
   * @param resourceUri 资源路径
   */
  hasLanguageSpecific(preferenceName: any, overrideIdentifier: string, resourceUri: string): boolean;

  /**
   * 设置一个配置的值
   * @param preferenceName 配置名称
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

  /**
   * 设置一个配置值，优先设置最高 Scope 级别的配置
   * 如，但设置了工作区配置的情况下，调用该方法将会优先更新工作区配置
   * @param preferenceName 配置名称
   * @param value 配置值
   * @param defaultScope 默认作用域，当查找不到配置值情况下使用该作用域设置配置值
   */
  update(preferenceName: string, value: any, defaultScope?: PreferenceScope): Promise<void>;

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
   */
  onSpecificPreferenceChange(preferenceName: string, listener: (change: PreferenceChange) => void): IDisposable;
}

export const PreferenceProviderProvider = Symbol('PreferenceProviderProvider');
export type PreferenceProviderProvider = (scope: PreferenceScope, uri?: URI) => PreferenceProvider;
