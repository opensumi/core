import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { PreferenceScope, PreferenceProvider, PreferenceSchemaProvider, IDisposable, addElement } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IPreferenceSettingsService, ISettingGroup, ISettingSection } from './types';
import { KeybindingsSettingsView } from './keybinding';

@Injectable()
export class PreferenceSettingsService implements IPreferenceSettingsService {

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Folder })
  folderPreference: PreferenceProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.User })
  userPreference: PreferenceProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Workspace })
  workspacePreference: PreferenceProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Default })
  defaultPreference: PreferenceProvider;

  @Autowired(IWorkspaceService)
  workspaceService;

  @observable
  list: { [key: string]: any } = {};

  selectedPreference: PreferenceProvider;

  private settingsGroups: ISettingGroup[] = [];

  private settingsSections: Map<string, ISettingSection[]> = new Map();

  constructor() {
    this.selectedPreference = this.userPreference;
    this.workspaceService.whenReady.finally(() => {
      this.userPreference.ready.finally(() => {
        this.getPreferences(this.userPreference);
      });
    });
    defaultSettingGroup.forEach((g) => {
      this.registerSettingGroup(g);
    });
    Object.keys(defaultSettingSections).forEach((key) => {
      defaultSettingSections[key].forEach((section) => {
        this.registerSettingSection(key, section);
      });
    });
  }

  public getPreferences = async (selectedPreference: PreferenceProvider) => {
    this.list = await selectedPreference.getPreferences();
  }

  public async setPreference(key: string, value: any, scope: PreferenceScope) {
    const selectedPreference = {
      [PreferenceScope.Folder]: this.folderPreference,
      [PreferenceScope.User]: this.userPreference,
      [PreferenceScope.Workspace]: this.workspacePreference,
      [PreferenceScope.Default]: this.defaultPreference,
    }[scope];
    return await selectedPreference.setPreference(key, value);
  }

  getSettingGroups(): ISettingGroup[] {
    return this.settingsGroups;
  }

  registerSettingGroup(group: ISettingGroup): IDisposable {
    return addElement(this.settingsGroups, group);
  }

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable {
    if (!this.settingsSections.has(groupId)) {
      this.settingsSections.set(groupId, []);
    }
    return addElement(this.settingsSections.get(groupId)!, section);
  }

  getSections(groupId: string): ISettingSection[] {
    return this.settingsSections.get(groupId) || [];
  }

  getPreference(preferenceName: string, scope: PreferenceScope, inherited: boolean = false): {value: any, inherited: boolean} {
    const providers = {
      [PreferenceScope.Folder]: this.folderPreference,
      [PreferenceScope.User]: this.userPreference,
      [PreferenceScope.Workspace]: this.workspacePreference,
      [PreferenceScope.Default]: this.defaultPreference,
    };
    const current = providers[scope];
    if (current.get(preferenceName) !== undefined) {
      return {value: current.get(preferenceName), inherited};
    } else {
      if (scope > 0) {
        return this.getPreference(preferenceName, scope - 1, true);
      } else {
        return { value: undefined, inherited: true};
      }
    }
  }

}

export const defaultSettingGroup: ISettingGroup[] = [
  {
    id: 'editor',
    title: '%settings.group.editor%',
    iconClass: 'volans_icon shell',
  },
  {
    id: 'shortcut',
    title: '%settings.group.shortcut%',
    iconClass: 'volans_icon keyboard',
  },
];

// TODO 做成Contribution分散到各个模块
export const defaultSettingSections: {
  [key: string]: ISettingSection[],
} = {
  editor: [
    {
      preferences: [
        {id: 'editor.fontFamily', localized: 'preference.editor.fontFamily'},
        {id: 'editor.fontWeight', localized: 'preference.editor.fontWeight'},
        {id: 'editor.fontSize', localized: 'preference.editor.fontSize'},
        {id: 'editor.tabSize', localized: 'preference.editor.tabSize'},
        {id: 'editor.renderWhitespace', localized: 'preference.editor.renderWhitespace'},
        {id: 'editor.cursorStyle', localized: 'preference.editor.cursorStyle'},
        {id: 'editor.insertSpace', localized: 'preference.editor.insertSpace'},
        {id: 'editor.wordWrap', localized: 'preference.editor.wordWrap'},
      ],
    },
  ],
  shortcut: [
    {
      preferences: [],
      component: KeybindingsSettingsView,
    },
  ],
};
