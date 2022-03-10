import { IDisposable } from '@opensumi/ide-core-common';

import { PreferenceScope } from './preference-scope';

export interface IPreferenceSettingsService {
  setPreference(key: string, value: any, scope: PreferenceScope);

  getSettingGroups(scope: PreferenceScope, search?: string): ISettingGroup[];

  registerSettingGroup(group: ISettingGroup): IDisposable;

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable;

  getSections(groupId: string, scope: PreferenceScope, search?: string): ISettingSection[];

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
  localized: string;
  /**
   * 在指定 scope 下不展示
   */
  hiddenInScope?: PreferenceScope[];
}

export interface ISettingSection {
  title?: string;

  preferences: Array<string | IPreferenceViewDesc>;

  component?: React.ComponentType<{ scope: PreferenceScope }>;

  hiddenInScope?: PreferenceScope[];
}
