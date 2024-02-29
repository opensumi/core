import { IDisposable, PreferenceScopeWithLabel } from '@opensumi/ide-core-common';

import { PreferenceScope } from './preference-scope';

export const IPreferenceSettingsService = Symbol('IPreferenceSettingsService');
export interface IPreferenceSettingsService {
  tabList: PreferenceScopeWithLabel[];

  setPreference(key: string, value: any, scope: PreferenceScope): void;

  getSettingGroups(scope: PreferenceScope, search?: string): ISettingGroup[];

  registerSettingGroup(group: ISettingGroup): IDisposable;

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable;

  getResolvedSections(groupId: string, scope: PreferenceScope, search?: string): IResolvedSettingSection[];
  getPreferenceViewDesc(preferenceId: string): IPreferenceViewDesc | undefined;
  getPreference(preferenceName: string, scope: PreferenceScope): { value: any; effectingScope: PreferenceScope };

  setEnumLabels(preferenceName: string, labels: { [key: string]: string }): void;

  scrollToGroup(groupId: string): void;
  scrollToSection(section: string): void;
  scrollToPreference(preferenceId: string): void;
  search(text: string): void;
}

export interface ISettingGroup {
  // 唯一
  id: string;
  title: string;
  iconClass: string;
}

export interface IPreferenceViewDesc {
  id: string;
  /**
   * 该设置项名字的本地化的 key
   *
   * 为空会根据 id 来生成展示的名字
   * 如：`enablePreview` -> `Enable Preview`
   */
  localized?: string;
  /**
   * 在指定 scope 下不展示
   */
  hiddenInScope?: PreferenceScope[];
}

export interface ISettingSection {
  /**
   * 插件 ID
   */
  extensionId?: string;
  /**
   * 该 Section 的名字
   */
  title?: string;
  /**
   * 该 Section 的设置项
   */
  preferences?: IPreferenceViewDesc[];
  /**
   * 该 Section 对应的 Component
   */
  component?: React.ComponentType<{ scope: PreferenceScope }>;
  /**
   * 该 Section 的子项，可用于树形展示嵌套
   */
  subSections?: ISettingSection[];
  /**
   * 要在哪些 Scope 中隐藏
   */
  hiddenInScope?: PreferenceScope[];
}

export interface IResolvedSettingSection extends ISettingSection {
  preferences?: IResolvedPreferenceViewDesc[];
  subSections?: IResolvedSettingSection[];
}

export interface IResolvedPreferenceViewDesc {
  id: string;
  /**
   * 本地化后的 label，即设置项的名字
   */
  label: string;
  /**
   * 本地化后的 description,即设置项的描述
   */
  description?: string;
  markdownDescription?: string;
}
