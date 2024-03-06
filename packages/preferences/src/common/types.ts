import {
  IDisposable,
  IResolvedPreferenceViewDesc,
  ISettingGroup,
  ISettingSection,
  PreferenceScope,
} from '@opensumi/ide-core-browser';

export const SettingContribution = Symbol('SettingContribution');

export interface ISettingRegistry {
  registerSettingGroup: (settingGroup: ISettingGroup) => IDisposable;
  registerSettingSection: (key: string, section: ISettingSection) => IDisposable;
}

export interface SettingContribution {
  /**
   * 注册 Setting
   * @param registry
   */
  registerSetting?(registry: ISettingRegistry): void;

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
  /**
   * 有两种：
   * - section:${sectionTitle}
   * - group:${groupId}
   */
  id?: string;
  scope: PreferenceScope;

  title?: string;
  component?: any;
  preference?: IResolvedPreferenceViewDesc;

  /**
   * 该 item 在左侧文件树的路径信息
   */
  _path?: string;
}

export const enum ESectionItemKind {
  Section = 'section:',
  Group = 'group:',
  Preference = 'preference:',
}
