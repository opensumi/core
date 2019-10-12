import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { PreferenceScope, PreferenceProvider, PreferenceSchemaProvider, IDisposable, addElement, getAvailableLanguages, PreferenceService } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IPreferenceSettingsService, ISettingGroup, ISettingSection } from '@ali/ide-core-browser';

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

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @observable
  list: { [key: string]: any } = {};

  selectedPreference: PreferenceProvider;

  private settingsGroups: ISettingGroup[] = [];

  private settingsSections: Map<string, ISettingSection[]> = new Map();

  private enumLabels: Map<string, {[key: string]: string}> = new Map();

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

    this.setEnumLabels('general.language', new Proxy({}, {
      get: (target, key ) => {
        return getAvailableLanguages().find((l) => l.languageId === key)!.localizedLanguageName;
      },
    }));
  }

  public getPreferences = async (selectedPreference: PreferenceProvider) => {
    this.list = await selectedPreference.getPreferences();
  }

  public async setPreference(key: string, value: any, scope: PreferenceScope) {
    return await this.preferenceService.set(key, value, scope);
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

  getSections(groupId: string, scope: PreferenceScope): ISettingSection[] {
    return (this.settingsSections.get(groupId) || []).filter((section) => {
      if (section.hiddenInScope && section.hiddenInScope.indexOf(scope) >= 0) {
        return false;
      } else {
        return true;
      }
    });
  }

  getPreference(preferenceName: string, scope: PreferenceScope, inherited: boolean = false): {value: any, inherited: boolean} {
    const { value, scope: resolvedScope } = (this.preferenceService as any).doResolve(preferenceName) || { value: undefined, scope: PreferenceScope.Default};
    return {
      value,
      inherited: resolvedScope !== scope,
    };
  }

  getEnumLabels(preferenceName: string): {[key: string]: string} {
    return this.enumLabels.get(preferenceName) || {};
  }

  setEnumLabels(preferenceName: string, labels: {[key: string]: string}) {
    this.enumLabels.set(preferenceName, labels);
  }

}

export const defaultSettingGroup: ISettingGroup[] = [
  {
    id: 'general',
    title: '%settings.group.general%',
    iconClass: 'volans_icon setting',
  },
  {
    id: 'editor',
    title: '%settings.group.editor%',
    iconClass: 'volans_icon shell',
  },
  {
    id: 'feature',
    title: '%settings.group.feature%',
    iconClass: '',
  },
];

// TODO 做成Contribution分散到各个模块
export const defaultSettingSections: {
  [key: string]: ISettingSection[],
} = {
  general: [
    {
      preferences: [
        {id: 'general.theme', localized: 'preference.general.theme'},
        {id: 'general.language', localized: 'preference.general.language'},
      ],
    },
  ],
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
  feature: [
    {
      preferences: [
        {id: 'files.exclude', localized: 'preference.files.exclude.title'},
        {id: 'files.watcherExclude', localized: 'preference.files.watcherExclude.title'},
        {id: 'search.exclude', localized: 'preference.search.exclude.title'},
      ],
    },
  ],
};
