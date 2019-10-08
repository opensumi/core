import { PreferenceScope, PreferenceSchemaProperty } from '@ali/ide-core-browser/lib/preferences';
import { IDisposable, Keybinding } from '@ali/ide-core-browser';

export interface IPreferenceSettingsService {

  setPreference(key: string, value: any, scope: PreferenceScope);

  getSettingGroups(): ISettingGroup[];

  registerSettingGroup(group: ISettingGroup): IDisposable;

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable;

  getSections(groupId: string): ISettingSection[];

  getPreference(preferenceName: string, scope: PreferenceScope): {value: any, inherited: boolean};
}

export const IPreferenceSettingsService = Symbol('IPreferenceSettingsService');

export interface ISettingGroup {

  // 唯一
  id: string;

  title: string;

  iconClass: string;

}

export interface ISettingSection {

  title?: string;

  preferences: Array<string | {id: string, localized: string} >;

  component?: React.ComponentClass<{scope: PreferenceScope}> | React.FunctionComponent <{scope: PreferenceScope}> ;
}
