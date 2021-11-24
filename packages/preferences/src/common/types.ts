import { ISettingGroup, ISettingSection, IDisposable, IPreferenceViewDesc, PreferenceScope } from '@opensumi/ide-core-browser';

export const SettingContribution = Symbol('SettingContribution');

export interface SettingContribution {
  /**
   * 注册 Setting
   * @param registry
   */
  registerSetting?(registy: {
    registerSettingGroup: (settingGroup: ISettingGroup) => IDisposable,
    registerSettingSection: (key: string, section: ISettingSection) => IDisposable,
  }): void;

  /**
   * 最后处理一次 SettingGroup
   * @params settingGroup
   */
  handleSettingGroup?(settingGroup: ISettingGroup[]): ISettingGroup[];

  /**
   * 最后处理一次 settingSections
   * @params settingSections
   */
  handleSettingSections?(settingSections: { [key: string]: ISettingSection[] }): { [key: string]: ISettingSection[] };
}

export interface IPreferenceTask {
  path: string[];
  key: string;
  value: string;
}

export interface ISectionItemData {
  scope: PreferenceScope;
  title?: string;
  component?: any;
  preference?: string | IPreferenceViewDesc;
}
