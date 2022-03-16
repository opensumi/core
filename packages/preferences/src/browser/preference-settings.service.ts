import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { IRecycleListHandler } from '@opensumi/ide-components';
import {
  IPreferenceViewDesc,
  IPreferenceSettingsService,
  ISettingGroup,
  ISettingSection,
  PreferenceProviderProvider,
  Emitter,
  Event,
  CommandService,
  getDebugLogger,
  isString,
  getIcon,
  PreferenceScope,
  PreferenceProvider,
  PreferenceSchemaProvider,
  IDisposable,
  addElement,
  getAvailableLanguages,
  PreferenceService,
  localize,
  replaceLocalizePlaceholder,
  ThrottledDelayer,
} from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { toPreferenceReadableName, PreferenceSettingId } from '../common';

import { PREFERENCE_COMMANDS } from './preference-contribution';

@Injectable()
export class PreferenceSettingsService implements IPreferenceSettingsService {
  private static DEFAULT_CHANGE_DELAY = 500;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  protected readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceProviderProvider)
  protected readonly providerProvider: PreferenceProviderProvider;

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @observable
  public currentGroup = '';

  @observable
  public currentSearch = '';

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

  private enumLabels: Map<string, { [key: string]: string }> = new Map();

  private cachedGroupSection: Map<string, ISettingSection[]> = new Map();

  private _listHandler: IRecycleListHandler;

  private onDidEnumLabelsChangeEmitter: Emitter<void> = new Emitter();
  private enumLabelsChangeDelayer = new ThrottledDelayer<void>(PreferenceSettingsService.DEFAULT_CHANGE_DELAY);

  constructor() {
    this.setEnumLabels(
      'general.language',
      new Proxy(
        {},
        {
          get: (target, key) => getAvailableLanguages().find((l) => l.languageId === key)!.localizedLanguageName,
        },
      ),
    );
    this.setEnumLabels('files.eol', {
      '\n': 'LF',
      '\r\n': 'CRLF',
      auto: 'auto',
    });
  }

  get onDidEnumLabelsChange() {
    return this.onDidEnumLabelsChangeEmitter.event;
  }

  private isContainSearchValue(value: string, search: string) {
    return value.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1;
  }

  private filterPreferences(preference: string | IPreferenceViewDesc, scope: PreferenceScope): boolean {
    return (
      typeof preference !== 'string' &&
      Array.isArray(preference.hiddenInScope) &&
      preference.hiddenInScope.includes(scope)
    );
  }

  @action
  private doSearch(value) {
    if (value) {
      this.currentSearch = value;
    } else {
      this.currentSearch = '';
    }
  }

  openJSON = (scope: PreferenceScope, preferenceId: string) => {
    // 根据节点信息打开 Settings.json 配置文件
    this.commandService.executeCommand(PREFERENCE_COMMANDS.OPEN_SOURCE_FILE.id, scope, preferenceId);
  };

  /**
   * 设置某个作用域下的配置值
   * @param key 配置Key
   * @param value 配置值
   * @param scope 作用域
   */
  async setPreference(key: string, value: any, scope: PreferenceScope) {
    await this.preferenceService.set(key, value, scope);
  }

  get listHandler() {
    return this._listHandler;
  }

  handleListHandler = (handler: any) => {
    this._listHandler = handler;
  };

  /**
   * 获取搜索条件下展示的设置面板配置组
   * @param scope 作用域
   * @param search 搜索值
   */
  getSettingGroups(scope: PreferenceScope, search?: string | undefined): ISettingGroup[] {
    this.currentScope = scope;
    const groups = this.settingsGroups.slice();
    return groups.filter((g) => this.getSections(g.id, scope, search).length > 0);
  }

  /**
   * 注册配置组
   * @param group 配置组
   */
  registerSettingGroup(group: ISettingGroup): IDisposable {
    const disposable = addElement(this.settingsGroups, group);
    return disposable;
  }

  /**
   * 在某个配置组下注册配置项
   * @param groupId 配置组ID
   * @param section 配置项内容
   */
  registerSettingSection(groupId: string, section: ISettingSection): IDisposable {
    if (!this.settingsSections.has(groupId)) {
      this.settingsSections.set(groupId, []);
    }
    this.cachedGroupSection.clear();
    const disposable = addElement(this.settingsSections.get(groupId)!, section);
    return disposable;
  }

  /**
   * 通过配置项ID获取配置项展示信息
   * @param preferenceId 配置项ID
   */
  getSectionByPreferenceId(preferenceId: string) {
    const groups = this.settingsSections.values();
    for (const sections of groups) {
      for (const section of sections) {
        for (const preference of section.preferences) {
          if (!isString(preference)) {
            if (preference.id === preferenceId) {
              return preference;
            }
          }
        }
      }
    }
  }

  /**
   * 获取特定作用域及搜索条件下的配置项
   * @param groupId 配置组ID
   * @param scope 作用域
   * @param search 搜索条件
   */
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
        const sec = { ...section };
        sec.preferences = section.preferences.filter((pref) => {
          if (this.filterPreferences(pref, scope)) {
            return false;
          }
          if (!search) {
            return true;
          }

          const prefId = typeof pref === 'string' ? pref : pref.id;
          const schema = this.schemaProvider.getPreferenceProperty(prefId);
          const prefLabel = typeof pref === 'string' ? toPreferenceReadableName(pref) : localize(pref.localized);
          const description = schema && replaceLocalizePlaceholder(schema.description);
          return (
            this.isContainSearchValue(prefId, search) ||
            this.isContainSearchValue(prefLabel, search) ||
            (description && this.isContainSearchValue(description, search))
          );
        });
        if (sec.preferences.length > 0) {
          result.push(sec);
        }
      }
    });
    this.cachedGroupSection.set(key.toLocaleLowerCase(), result);
    return result;
  }

  /**
   * 获取某个配置名在特定作用域下的值
   * @param preferenceName 配置名
   * @param scope 作用域
   * @param inherited 是否继承低优先级的配置值
   */
  getPreference(
    preferenceName: string,
    scope: PreferenceScope,
    inherited = false,
  ): { value: any; effectingScope: PreferenceScope } {
    const { value } = this.preferenceService.resolve(preferenceName, undefined, undefined, undefined, scope) || {
      value: undefined,
      scope: PreferenceScope.Default,
    };
    const { scope: effectingScope } = this.preferenceService.resolve(preferenceName) || {
      value: undefined,
      scope: PreferenceScope.Default,
    };
    return {
      value,
      effectingScope: effectingScope || PreferenceScope.Default,
    };
  }

  /**
   * 获取某个配置名下存在的Enum枚举项
   * @param preferenceName 配置名
   */
  getEnumLabels(preferenceName: string): { [key: string]: string } {
    return this.enumLabels.get(preferenceName) || {};
  }

  /**
   * 设置某个配置名下的Enum枚举项
   * @param preferenceName 配置名
   * @param labels 枚举项
   */
  setEnumLabels(preferenceName: string, labels: { [key: string]: string }) {
    if (this.enumLabelsChangeDelayer && !this.enumLabelsChangeDelayer.isTriggered()) {
      this.enumLabelsChangeDelayer.cancel();
    }
    this.enumLabelsChangeDelayer.trigger(async () => {
      this.onDidEnumLabelsChangeEmitter.fire();
    });
    this.enumLabels.set(preferenceName, labels);
  }

  /**
   * 重置某个配置项在特定作用域下的值
   * @param preferenceName 配置名
   * @param scope 作用域
   */
  async reset(preferenceName: string, scope: PreferenceScope) {
    await this.preferenceService.set(preferenceName, undefined, scope);
  }

  /**
   * 获取特定作用域下的配置文件路径
   * @param scope 作用域
   */
  async getPreferenceUrl(scope: PreferenceScope) {
    const preferenceProvider: PreferenceProvider = this.providerProvider(scope);
    const resource = await preferenceProvider.resource;

    if (resource) {
      return resource.uri;
    } else {
      return preferenceProvider.getConfigUri()?.toString();
    }
  }

  /**
   * 获取当前面板下对应的配置文件路径
   * @param scope 作用域
   */
  async getCurrentPreferenceUrl(scope?: PreferenceScope) {
    // 默认获取全局设置的URI
    const url = await this.getPreferenceUrl(scope || this.currentScope || PreferenceScope.User)!;
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

  /**
   * 在设置面板下搜索配置
   * @param value 搜索值
   */
  search = (value: string) => {
    this.doSearch(value);
  };

  private readonly _onFocus: Emitter<void> = new Emitter<void>();

  get onFocus(): Event<void> {
    return this._onFocus.event;
  }

  focusInput() {
    this._onFocus.fire();
  }
}

export const defaultSettingGroup: ISettingGroup[] = [
  {
    id: PreferenceSettingId.General,
    title: '%settings.group.general%',
    iconClass: getIcon('setting'),
  },
  {
    id: PreferenceSettingId.Editor,
    title: '%settings.group.editor%',
    iconClass: getIcon('editor'),
  },
  {
    id: PreferenceSettingId.Terminal,
    title: '%settings.group.terminal%',
    iconClass: getIcon('terminal'),
  },
  {
    id: PreferenceSettingId.Feature,
    title: '%settings.group.feature%',
    iconClass: getIcon('file-text'),
  },
  {
    id: PreferenceSettingId.View,
    title: '%settings.group.view%',
    iconClass: getIcon('detail'),
  },
];

export const defaultSettingSections: {
  [key: string]: ISettingSection[];
} = {
  general: [
    {
      preferences: [
        { id: 'general.theme', localized: 'preference.general.theme' },
        { id: 'general.icon', localized: 'preference.general.icon' },
        {
          id: 'general.language',
          localized: 'preference.general.language',
          hiddenInScope: [PreferenceScope.Workspace],
        },
      ],
    },
  ],
  editor: [
    {
      preferences: [
        // 预览模式
        { id: 'editor.previewMode', localized: 'preference.editor.previewMode' },
        {
          id: 'editor.enablePreviewFromCodeNavigation',
          localized: 'preference.editor.enablePreviewFromCodeNavigation',
        },
        // 自动保存
        { id: 'editor.autoSave', localized: 'preference.editor.autoSave' },
        { id: 'editor.autoSaveDelay', localized: 'preference.editor.autoSaveDelay' },
        {
          id: 'workbench.refactoringChanges.showPreviewStrategy',
          localized: 'preference.workbench.refactoringChanges.showPreviewStrategy.title',
        },
        { id: 'editor.askIfDiff', localized: 'preference.editor.askIfDiff' },
        // 光标样式
        { id: 'editor.cursorStyle', localized: 'preference.editor.cursorStyle' },
        // 字体
        { id: 'editor.fontSize', localized: 'preference.editor.fontSize' },
        { id: 'editor.fontWeight', localized: 'preference.editor.fontWeight' },
        { id: 'editor.fontFamily', localized: 'preference.editor.fontFamily' },
        { id: 'editor.lineHeight', localized: 'preference.editor.lineHeight' },
        // 补全
        { id: 'editor.suggest.insertMode', localized: 'preference.editor.suggest.insertMode' },
        { id: 'editor.suggest.filterGraceful', localized: 'preference.editor.suggest.filterGraceful' },
        { id: 'editor.suggest.localityBonus', localized: 'preference.editor.suggest.localityBonus' },
        { id: 'editor.suggest.shareSuggestSelections', localized: 'preference.editor.suggest.shareSuggestSelections' },
        {
          id: 'editor.suggest.snippetsPreventQuickSuggestions',
          localized: 'preference.editor.suggest.snippetsPreventQuickSuggestions',
        },
        { id: 'editor.suggest.showIcons', localized: 'preference.editor.suggest.showIcons' },
        { id: 'editor.suggest.maxVisibleSuggestions', localized: 'preference.editor.suggest.maxVisibleSuggestions' },
        { id: 'editor.suggest.showMethods', localized: 'preference.editor.suggest.showMethods' },
        { id: 'editor.suggest.showFunctions', localized: 'preference.editor.suggest.showFunctions' },
        { id: 'editor.suggest.showConstructors', localized: 'preference.editor.suggest.showConstructors' },
        { id: 'editor.suggest.showFields', localized: 'preference.editor.suggest.showFields' },
        { id: 'editor.suggest.showVariables', localized: 'preference.editor.suggest.showVariables' },
        { id: 'editor.suggest.showClasses', localized: 'preference.editor.suggest.showClasses' },
        { id: 'editor.suggest.showStructs', localized: 'preference.editor.suggest.showStructs' },
        { id: 'editor.suggest.showInterfaces', localized: 'preference.editor.suggest.showInterfaces' },
        { id: 'editor.suggest.showModules', localized: 'preference.editor.suggest.showModules' },
        { id: 'editor.suggest.showProperties', localized: 'preference.editor.suggest.showProperties' },
        { id: 'editor.suggest.showEvents', localized: 'preference.editor.suggest.showEvents' },
        { id: 'editor.suggest.showOperators', localized: 'preference.editor.suggest.showOperators' },
        { id: 'editor.suggest.showUnits', localized: 'preference.editor.suggest.showUnits' },
        { id: 'editor.suggest.showValues', localized: 'preference.editor.suggest.showValues' },
        { id: 'editor.suggest.showConstants', localized: 'preference.editor.suggest.showConstants' },
        { id: 'editor.suggest.showEnums', localized: 'preference.editor.suggest.showEnums' },
        { id: 'editor.suggest.showEnumMembers', localized: 'preference.editor.suggest.showEnumMembers' },
        { id: 'editor.suggest.showKeywords', localized: 'preference.editor.suggest.showKeywords' },
        { id: 'editor.suggest.showWords', localized: 'preference.editor.suggest.showWords' },
        { id: 'editor.suggest.showColors', localized: 'preference.editor.suggest.showColors' },
        { id: 'editor.suggest.showFiles', localized: 'preference.editor.suggest.showFiles' },
        { id: 'editor.suggest.showReferences', localized: 'preference.editor.suggest.showReferences' },
        { id: 'editor.suggest.showCustomcolors', localized: 'preference.editor.suggest.showCustomcolors' },
        { id: 'editor.suggest.showFolders', localized: 'preference.editor.suggest.showFolders' },
        { id: 'editor.suggest.showTypeParameters', localized: 'preference.editor.suggest.showTypeParameters' },
        { id: 'editor.suggest.showSnippets', localized: 'preference.editor.suggest.showSnippets' },
        { id: 'editor.suggest.showUsers', localized: 'preference.editor.suggest.showUsers' },
        { id: 'editor.suggest.showIssues', localized: 'preference.editor.suggest.showIssues' },
        { id: 'editor.suggest.preview', localized: 'preference.editor.suggest.preview' },

        // Guides
        { id: 'editor.guides.bracketPairs', localized: 'preference.editor.guides.bracketPairs' },
        { id: 'editor.guides.indentation', localized: 'preference.editor.guides.indentation' },
        {
          id: 'editor.guides.highlightActiveIndentation',
          localized: 'preference.editor.guides.highlightActiveIndentation',
        },

        // 行内补全
        { id: 'editor.inlineSuggest.enabled', localized: 'preference.editor.inlineSuggest.enabled' },

        // 缩进
        { id: 'editor.detectIndentation', localized: 'preference.editor.detectIndentation' },
        { id: 'editor.tabSize', localized: 'preference.editor.tabSize' },
        { id: 'editor.insertSpaces', localized: 'preference.editor.insertSpace' },
        // 显示
        { id: 'editor.wordWrap', localized: 'preference.editor.wordWrap' },
        { id: 'editor.renderLineHighlight', localized: 'preference.editor.renderLineHighlight' },
        { id: 'editor.renderWhitespace', localized: 'preference.editor.renderWhitespace' },
        { id: 'editor.minimap', localized: 'preference.editor.minimap' },
        // 格式化
        { id: 'editor.preferredFormatter', localized: 'preference.editor.preferredFormatter' },
        { id: 'editor.formatOnSave', localized: 'preference.editor.formatOnSave' },
        { id: 'editor.formatOnSaveTimeout', localized: 'preference.editor.formatOnSaveTimeout' },
        { id: 'editor.formatOnPaste', localized: 'preference.editor.formatOnPaste' },
        // 智能提示
        { id: 'editor.quickSuggestionsDelay', localized: 'preference.editor.quickSuggestionsDelay' },
        // 文件
        // `forceReadOnly` 选项暂时不对用户暴露
        // {id: 'editor.forceReadOnly', localized: 'preference.editor.forceReadOnly'},

        { id: 'files.autoGuessEncoding', localized: 'preference.files.autoGuessEncoding.title' },
        { id: 'files.encoding', localized: 'preference.files.encoding.title' },
        { id: 'files.eol', localized: 'preference.files.eol' },
        { id: 'editor.readonlyFiles', localized: 'preference.editor.readonlyFiles' },
        { id: 'files.exclude', localized: 'preference.files.exclude.title' },
        { id: 'files.watcherExclude', localized: 'preference.files.watcherExclude.title' },
        { id: 'files.associations', localized: 'preference.files.associations.title' },
        { id: 'editor.maxTokenizationLineLength', localized: 'preference.editor.maxTokenizationLineLength' },
        { id: 'editor.largeFile', localized: 'preference.editor.largeFile' },
        {
          id: 'editor.bracketPairColorization.enabled',
          localized: 'preference.editor.bracketPairColorization.enabled',
        },
        // Diff 编辑器
        { id: 'diffEditor.renderSideBySide', localized: 'preference.diffEditor.renderSideBySide' },
        { id: 'diffEditor.ignoreTrimWhitespace', localized: 'preference.diffEditor.ignoreTrimWhitespace' },
      ],
    },
  ],
  terminal: [
    {
      preferences: [
        // 终端类型
        { id: 'terminal.type', localized: 'preference.terminal.type' },
        // 字体
        { id: 'terminal.fontFamily', localized: 'preference.terminal.fontFamily' },
        { id: 'terminal.fontSize', localized: 'preference.terminal.fontSize' },
        { id: 'terminal.fontWeight', localized: 'preference.terminal.fontWeight' },
        { id: 'terminal.lineHeight', localized: 'preference.terminal.lineHeight' },
        // 光标
        { id: 'terminal.cursorBlink', localized: 'preference.terminal.cursorBlink' },
        // 显示
        { id: 'terminal.scrollback', localized: 'preference.terminal.scrollback' },
        // 命令行参数
        { id: 'terminal.integrated.shellArgs.linux', localized: 'preference.terminal.integrated.shellArgs.linux' },
      ],
    },
  ],
  feature: [
    {
      preferences: [
        // 树/列表项
        { id: 'workbench.list.openMode', localized: 'preference.workbench.list.openMode.title' },
        { id: 'explorer.autoReveal', localized: 'preference.explorer.autoReveal' },
        // 搜索
        { id: 'search.exclude', localized: 'preference.search.exclude.title' },
        { id: 'files.exclude', localized: 'preference.files.exclude.title' },
        { id: 'files.watcherExclude', localized: 'preference.files.watcherExclude.title' },
        // 输出
        { id: 'output.maxChannelLine', localized: 'output.maxChannelLine' },
        { id: 'output.enableLogHighlight', localized: 'output.enableLogHighlight' },
        { id: 'output.enableSmartScroll', localized: 'output.enableSmartScroll' },
        // 调试
        // 由于筛选器的匹配模式搜索存在性能、匹配难度大等问题，先暂时隐藏
        // { id: 'debug.console.filter.mode', localized: 'preference.debug.console.filter.mode' },
        { id: 'debug.console.wordWrap', localized: 'preference.debug.console.wordWrap' },
        { id: 'debug.inline.values', localized: 'preference.debug.inline.values' },
      ],
    },
  ],
  view: [
    {
      preferences: [
        // 编辑器外观
        { id: 'editor.wrapTab', localized: 'preference.editor.wrapTab' },
        // 资源管理器
        { id: 'explorer.fileTree.baseIndent', localized: 'preference.explorer.fileTree.baseIndent.title' },
        { id: 'explorer.fileTree.indent', localized: 'preference.explorer.fileTree.indent.title' },
        { id: 'explorer.compactFolders', localized: 'preference.explorer.compactFolders.title' },
        // 运行与调试
        { id: 'debug.toolbar.float', localized: 'preference.debug.toolbar.float.title' },
        // 布局信息
        { id: 'view.saveLayoutWithWorkspace', localized: 'preference.view.saveLayoutWithWorkspace.title' },
      ],
    },
  ],
};
