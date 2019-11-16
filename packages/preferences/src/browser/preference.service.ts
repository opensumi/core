import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { PreferenceScope, PreferenceProvider, PreferenceSchemaProvider, IDisposable, addElement, getAvailableLanguages, PreferenceService, IClientApp, localize, replaceLocalizePlaceholder } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IPreferenceSettingsService, ISettingGroup, ISettingSection } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { IDialogService } from '@ali/ide-overlay';
import { toPreferenceReadableName } from '../common';

@Injectable()
export class PreferenceSettingsService implements IPreferenceSettingsService {

  @Autowired(IWorkspaceService)
  workspaceService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  schemaProvider: PreferenceSchemaProvider;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  private settingsGroups: ISettingGroup[] = [];

  private settingsSections: Map<string, ISettingSection[]> = new Map();

  private enumLabels: Map<string, {[key: string]: string}> = new Map();

  private cachedGroupSection: Map<string, ISettingSection[]> = new Map();

  constructor() {
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

  public async setPreference(key: string, value: any, scope: PreferenceScope) {
    await this.preferenceService.set(key, value, scope);
    if (key === 'general.language' ) {
      this.onLocalizationLanguageChanged();
    }
  }

  private async onLocalizationLanguageChanged() {

    const msg = await this.dialogService.info(
      localize('preference.general.language.change.refresh.info', '更改语言后需重启后生效，是否立即刷新?'),
      [
        localize('preference.general.language.change.refresh.later', '稍后自己刷新'),
        localize('preference.general.language.change.refresh.now', '立即刷新'),
      ],
    );
    if (msg === localize('preference.general.language.change.refresh.now', '立即刷新')) {
      this.clientApp.fireOnReload();
    }
  }

  getSettingGroups(scope: PreferenceScope, search?: string | undefined): ISettingGroup[] {
    const groups = this.settingsGroups.slice();
    return groups.filter((g) => this.getSections(g.id, scope, search).length > 0);
  }

  registerSettingGroup(group: ISettingGroup): IDisposable {
    return addElement(this.settingsGroups, group);
  }

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable {
    if (!this.settingsSections.has(groupId)) {
      this.settingsSections.set(groupId, []);
    }
    this.cachedGroupSection.clear();
    return addElement(this.settingsSections.get(groupId)!, section);
  }

  getSections(groupId: string, scope: PreferenceScope, search?: string): ISettingSection[] {
    const key = [groupId, scope, search || ''].join('-');
    if (this.cachedGroupSection.has(key)) {
      return this.cachedGroupSection.get(key)!;
    }
    const res = (this.settingsSections.get(groupId) || []).filter((section) => {
      if (section.hiddenInScope && section.hiddenInScope.indexOf(scope) >= 0) {
        return false;
      } else {
        return true;
      }
    });
    if (!search) {
      this.cachedGroupSection.set(key, res);
      return res;
    } else {
      const filtered: ISettingSection[] = [];
      res.forEach((section) => {
        if (section.preferences) {
          const sec = {...section};
          sec.preferences = section.preferences.filter((pref) => {
            const prefId = typeof pref === 'string' ? pref : pref.id;
            const schema = this.schemaProvider.getPreferenceProperty(prefId);
            const prefLabel = typeof pref === 'string' ? toPreferenceReadableName(pref) : localize(pref.localized);
            const description = schema && replaceLocalizePlaceholder(schema.description);
            return prefId.indexOf(search) > -1 || prefLabel.indexOf(search) > -1 || (description && description.indexOf(search) > -1);
          });
          if (sec.preferences.length > 0) {
            filtered.push(sec);
          }
        }
      });
      this.cachedGroupSection.set(key, filtered);
      return filtered;
    }
  }

  getPreference(preferenceName: string, scope: PreferenceScope, inherited: boolean = false): {value: any, effectingScope: PreferenceScope} {
    const { value, scope: resolvedScope } = (this.preferenceService as any).doResolve(preferenceName, undefined, undefined, scope) || { value: undefined, scope: PreferenceScope.Default};
    const { effectingValue, scope: effectingScope } = (this.preferenceService as any).doResolve(preferenceName, undefined, undefined) || { value: undefined, scope: PreferenceScope.Default};
    return {
      value,
      effectingScope,
    };
  }

  getEnumLabels(preferenceName: string): {[key: string]: string} {
    return this.enumLabels.get(preferenceName) || {};
  }

  setEnumLabels(preferenceName: string, labels: {[key: string]: string}) {
    this.enumLabels.set(preferenceName, labels);
  }

  async reset(preferenceName: string, scope: PreferenceScope) {
    await this.preferenceService.set(preferenceName, undefined, scope);
    if (preferenceName === 'general.language' ) {
      this.onLocalizationLanguageChanged();
    }
  }
}

export const defaultSettingGroup: ISettingGroup[] = [
  {
    id: 'general',
    title: '%settings.group.general%',
    iconClass: getIcon('setting-general'),
  },
  {
    id: 'editor',
    title: '%settings.group.editor%',
    iconClass: getIcon('setting-editor'),
  },
  {
    id: 'feature',
    title: '%settings.group.feature%',
    iconClass: getIcon('setting-file'),
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
        {id: 'general.icon', localized: 'preference.general.icon'},
        {id: 'general.language', localized: 'preference.general.language'},
      ],
    },
  ],
  editor: [
    {
      preferences: [
        {id: 'editor.previewMode', localized: 'preference.editor.previewMode'},
        {id: 'editor.askIfDiff', localized: 'preference.editor.askIfDiff' },
        {id: 'editor.fontFamily', localized: 'preference.editor.fontFamily'},
        {id: 'editor.fontWeight', localized: 'preference.editor.fontWeight'},
        {id: 'editor.fontSize', localized: 'preference.editor.fontSize'},
        {id: 'editor.tabSize', localized: 'preference.editor.tabSize'},
        {id: 'editor.renderWhitespace', localized: 'preference.editor.renderWhitespace'},
        {id: 'editor.cursorStyle', localized: 'preference.editor.cursorStyle'},
        {id: 'editor.insertSpace', localized: 'preference.editor.insertSpace'},
        {id: 'editor.wordWrap', localized: 'preference.editor.wordWrap'},
        {id: 'editor.readonlyFiles', localized: 'preference.editor.readonlyFiles'},
        {id: 'editor.formatOnSave', localized: 'preference.editor.formatOnSave'},
        {id: 'editor.formatOnSaveTimeout', localized: 'preference.editor.formatOnSaveTimeout'},
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
