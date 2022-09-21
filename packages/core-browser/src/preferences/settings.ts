import { IDisposable } from '@opensumi/ide-core-common';

import { PreferenceScope } from './preference-scope';

export interface IPreferenceSettingsService {
  setPreference(key: string, value: any, scope: PreferenceScope);

  getSettingGroups(scope: PreferenceScope, search?: string): ISettingGroup[];

  registerSettingGroup(group: ISettingGroup): IDisposable;

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable;

  getResolvedSections(groupId: string, scope: PreferenceScope, search?: string): IResolvedSettingSection[];

  getPreference(preferenceName: string, scope: PreferenceScope): { value: any; effectingScope: PreferenceScope };

  setEnumLabels(preferenceName: string, labels: { [key: string]: string }): void;

  setCurrentGroup(groupId: string): void;
}

export const IPreferenceSettingsService = Symbol('IPreferenceSettingsService');

export interface ISettingGroup {
  // 唯一
  id: string;
  title: string;
  iconClass: string;
}

export interface IPreferenceViewDesc {
  id: string;
  /**
   * 对于名字要进行本地化的 key
   *
   * 为空会根据 id 来生成展示的名字
   * 如：`enablePreview` -> `Enable Preview`
   */
  i18n?: string;
  /**
   * 在指定 scope 下不展示
   */
  hiddenInScope?: PreferenceScope[];
}

export interface ISettingSection {
  title?: string;
  /**
   * 开启这个选项后，设置项面板可以自动将当前 Settings Section 按照 id 分组在 UI 上展示出来
   */
  // automaticallyGroupById?: boolean;

  preferences?: IPreferenceViewDesc[];

  component?: React.ComponentType<{ scope: PreferenceScope }>;

  subSettingSections?: ISettingSection[];

  hiddenInScope?: PreferenceScope[];
}

export interface IResolvedSettingSection extends ISettingSection {
  preferences?: IResolvedPreferenceViewDesc[];
  subSettingSections?: IResolvedSettingSection[];
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

  /**
   * 用户可能会传两种 description 进来，该属性是最终要使用的 description
   *
   * 优先级：markdownDescription > description
   */
  _description?: string;
}
