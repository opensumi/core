import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { PreferenceScope, PreferenceProvider, PreferenceSchemaProvider, IDisposable, addElement, getAvailableLanguages, PreferenceService, IClientApp, localize, replaceLocalizePlaceholder } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IPreferenceViewDesc, IPreferenceSettingsService, ISettingGroup, ISettingSection, PreferenceProviderProvider } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser';
import { getDebugLogger } from '@ali/ide-core-common';
import { IDialogService } from '@ali/ide-overlay';

import { toPreferenceReadableName } from '../common';
import { IFileServiceClient } from '@ali/ide-file-service';

@Injectable()
export class PreferenceSettingsService implements IPreferenceSettingsService {

  @Autowired(IWorkspaceService)
  protected readonly workspaceService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  protected readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceProviderProvider)
  protected readonly providerProvider: PreferenceProviderProvider;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(IClientApp)
  protected readonly clientApp: IClientApp;

  @observable
  public currentGroup: string = '';

  private pendingSearch: string | undefined = undefined;

  private searchInput: HTMLInputElement | null = null;

  private currentScope: PreferenceScope;

  public setCurrentGroup(groupId: string) {
    if (this.settingsGroups.find((n) => n.id === groupId)) {
      this.currentGroup = groupId;
      return;
    }
    getDebugLogger('Preference').warn('PreferenceService#setCurrentGroup is called with an invalid groupId:', groupId);
  }

  private settingsGroups: ISettingGroup[] = [];

  private settingsSections: Map<string, ISettingSection[]> = new Map();

  private enumLabels: Map<string, {[key: string]: string}> = new Map();

  private cachedGroupSection: Map<string, ISettingSection[]> = new Map();

  constructor() {
    this.setEnumLabels('general.language', new Proxy({}, {
      get: (target, key ) => {
        return getAvailableLanguages().find((l) => l.languageId === key)!.localizedLanguageName;
      },
    }));
    this.setEnumLabels('files.eol', {
      '\n': 'LF',
      '\r\n': 'CRLF',
      'auto': 'auto',
    });
  }

  /**
   * @deprecated
   */
  public async setPreference(key: string, value: any, scope: PreferenceScope) {
    await this.preferenceService.set(key, value, scope);
  }

  getSettingGroups(scope: PreferenceScope, search?: string | undefined): ISettingGroup[] {
    this.currentScope = scope;
    const groups = this.settingsGroups.slice();
    return groups.filter((g) => this.getSections(g.id, scope, search).length > 0);
  }

  registerSettingGroup(group: ISettingGroup): IDisposable {
    const disposable = addElement(this.settingsGroups, group);
    return disposable;
  }

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable {
    if (!this.settingsSections.has(groupId)) {
      this.settingsSections.set(groupId, []);
    }
    this.cachedGroupSection.clear();
    const disposable = addElement(this.settingsSections.get(groupId)!, section);
    return disposable;
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

    const result: ISettingSection[] = [];

    res.forEach((section) => {
      if (section.preferences) {
        const sec = {...section};
        sec.preferences = section.preferences
          .filter((pref) => {
            if (this._filterPreference(pref, scope)) {
              return false;
            }
            if (!search) {
              return true;
            }

            const prefId = typeof pref === 'string' ? pref : pref.id;
            const schema = this.schemaProvider.getPreferenceProperty(prefId);
            const prefLabel = typeof pref === 'string' ? toPreferenceReadableName(pref) : localize(pref.localized);
            const description = schema && replaceLocalizePlaceholder(schema.description);
            return prefId.indexOf(search) > -1 || prefLabel.indexOf(search) > -1 || (description && description.indexOf(search) > -1);
          });
        if (sec.preferences.length > 0) {
          result.push(sec);
        }
      }
    });
    this.cachedGroupSection.set(key, result);
    return result;
  }

  private _filterPreference(preference: string | IPreferenceViewDesc, scope: PreferenceScope): boolean {
    return typeof preference !== 'string' && Array.isArray(preference.hiddenInScope) && preference.hiddenInScope.includes(scope);
  }

  getPreference(preferenceName: string, scope: PreferenceScope, inherited: boolean = false): {value: any, effectingScope: PreferenceScope} {
    const { value } = (this.preferenceService as any).doResolve(preferenceName, undefined, undefined, scope) || { value: undefined, scope: PreferenceScope.Default};
    const { scope: effectingScope } = (this.preferenceService as any).doResolve(preferenceName, undefined, undefined) || { value: undefined, scope: PreferenceScope.Default};
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
  }

  async getPreferenceUrl(scope: PreferenceScope) {
    const preferenceProvider: PreferenceProvider = this.providerProvider(scope);
    const resource = await preferenceProvider.resource;
    if (resource && resource.getFsPath) {
      return await resource.getFsPath();
    } else {
      return preferenceProvider.getConfigUri()?.toString();
    }
  }

  async getCurrentPreferenceUrl(scope?: PreferenceScope) {
    // 默认获取全局设置的URI
    const url =  await this.getPreferenceUrl(scope || this.currentScope || PreferenceScope.User)!;
    if (!url) {
      return;
    }
    const exist = await this.fileServiceClient.access(url);
    if (!exist) {
      const fileStat = await this.fileServiceClient.createFile(url);
      if (fileStat) {
        await this.fileServiceClient.setContent(fileStat!, '{\n}');
      }
    }
    return url;
  }

  search(value) {
    if (this.searchInput) {
      this.doSearch(value);
    } else {
      this.pendingSearch = value;
    }
  }

  doSearch(value) {
    // React 上手动触发 onChange 的方法
    // FIXME: 这里不该直接去操作DOM来触发搜索操作 @吭头
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set;
    nativeInputValueSetter!.call(this.searchInput!, value);
    const ev2 = new Event('input', { bubbles: true});
    this.searchInput!.dispatchEvent(ev2);
  }

  public onSearchInputRendered(input: HTMLInputElement | null) {

    this.searchInput = input;
    if (input && this.pendingSearch) {
      this.doSearch(this.pendingSearch);
      this.pendingSearch = undefined;
    }
  }
}

export const defaultSettingGroup: ISettingGroup[] = [
  {
    id: 'general',
    title: '%settings.group.general%',
    iconClass: getIcon('setting'),
  },
  {
    id: 'editor',
    title: '%settings.group.editor%',
    iconClass: getIcon('codelibrary-fill'),
  },
  {
    id: 'terminal',
    title: '%settings.group.terminal%',
    iconClass: getIcon('codelibrary-fill'),
  },
  {
    id: 'feature',
    title: '%settings.group.feature%',
    iconClass: getIcon('file-text'),
  },
  {
    id: 'view',
    title: '%settings.group.view%',
    iconClass: getIcon('detail'),
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
        {id: 'general.language', localized: 'preference.general.language', hiddenInScope: [PreferenceScope.Workspace]},
      ],
    },
  ],
  editor: [
    {
      preferences: [
        {id: 'editor.autoSave', localized: 'preference.editor.autoSave'},
        {id: 'editor.autoSaveDelay', localized: 'preference.editor.autoSaveDelay'},
        {id: 'editor.previewMode', localized: 'preference.editor.previewMode'},
        {id: 'workbench.list.openMode', localized: 'preference.workbench.list.openMode'},
        {id: 'workbench.refactoringChanges.showPreviewStrategy', localized: 'preference.workbench.refactoringChanges.showPreviewStrategy'},
        {id: 'editor.askIfDiff', localized: 'preference.editor.askIfDiff' },
        {id: 'editor.fontFamily', localized: 'preference.editor.fontFamily'},
        {id: 'editor.minimap', localized: 'preference.editor.minimap'},
        // `forceReadOnly` 选项暂时不对用户暴露
        // {id: 'editor.forceReadOnly', localized: 'preference.editor.forceReadOnly'},
        {id: 'editor.renderLineHighlight', localized: 'preference.editor.renderLineHighlight'},
        {id: 'editor.fontWeight', localized: 'preference.editor.fontWeight'},
        {id: 'editor.fontSize', localized: 'preference.editor.fontSize'},
        {id: 'editor.detectIndentation', localized: 'preference.editor.detectIndentation'},
        {id: 'editor.tabSize', localized: 'preference.editor.tabSize'},
        {id: 'editor.insertSpaces', localized: 'preference.editor.insertSpace'},
        {id: 'editor.renderWhitespace', localized: 'preference.editor.renderWhitespace'},
        {id: 'editor.cursorStyle', localized: 'preference.editor.cursorStyle'},
        {id: 'editor.wordWrap', localized: 'preference.editor.wordWrap'},
        {id: 'editor.readonlyFiles', localized: 'preference.editor.readonlyFiles'},
        {id: 'editor.preferredFormatter', localized: 'preference.editor.preferredFormatter' },
        {id: 'editor.formatOnSave', localized: 'preference.editor.formatOnSave'},
        {id: 'editor.formatOnSaveTimeout', localized: 'preference.editor.formatOnSaveTimeout'},
        {id: 'editor.maxTokenizationLineLength', localized: 'preference.editor.maxTokenizationLineLength'},
        {id: 'editor.quickSuggestionsDelay', localized: 'preference.editor.quickSuggestionsDelay'},
        {id: 'editor.largeFile', localized: 'preference.editor.largeFile' },
        {id: 'editor.formatOnPaste', localized: 'preference.editor.formatOnPaste' },
        {id: 'diffEditor.renderSideBySide', localized: 'preference.diffEditor.renderSideBySide' },
        {id: 'diffEditor.ignoreTrimWhitespace', localized: 'preference.diffEditor.ignoreTrimWhitespace' },
      ],
    },
  ],
  terminal: [
    {
      preferences: [
        { id: 'terminal.type', localized: 'preference.terminal.type' },
        { id: 'terminal.fontFamily', localized: 'preference.terminal.fontFamily' },
        { id: 'terminal.fontSize', localized: 'preference.terminal.fontSize' },
        { id: 'terminal.fontWeight', localized: 'preference.terminal.fontWeight' },
        { id: 'terminal.lineHeight', localized: 'preference.terminal.lineHeight' },
        { id: 'terminal.cursorBlink', localized: 'preference.terminal.cursorBlink' },
        { id: 'terminal.scrollback', localized: 'preference.terminal.scrollback' },
        { id: 'terminal.integrated.shellArgs.linux', localized: 'preference.terminal.integrated.shellArgs.linux' },
      ],
    },
  ],
  feature: [
    {
      preferences: [
        {id: 'files.encoding', localized: 'preference.files.encoding.title'},
        {id: 'files.exclude', localized: 'preference.files.exclude.title'},
        {id: 'files.watcherExclude', localized: 'preference.files.watcherExclude.title'},
        {id: 'files.associations', localized: 'preference.files.associations.title'},
        {id: 'files.eol', localized: 'preference.files.eol' },
        {id: 'search.exclude', localized: 'preference.search.exclude.title'},
        {id: 'output.maxChannelLine', localized: 'output.maxChannelLine'},
        {id: 'output.enableLogHighlight', localized: 'output.enableLogHighlight'},
        {id: 'output.enableSmartScroll', localized: 'output.enableSmartScroll'},
      ],
    },
  ],
  view: [
    {
      preferences: [
        {id: 'explorer.fileTree.baseIndent', localized: 'preference.explorer.fileTree.baseIndent.title'},
        {id: 'explorer.fileTree.indent', localized: 'preference.explorer.fileTree.indent.title'},
        {id: 'explorer.compactFolders', localized: 'preference.explorer.compactFolders'},
        {id: 'explorer.autoReveal', localized: 'preference.explorer.autoReveal'},
        {id: 'debug.toolbar.float', localized: 'preference.debug.toolbar.float.title'},
      ],
    },
  ],
};
