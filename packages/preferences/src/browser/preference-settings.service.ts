import groupBy from 'lodash/groupBy';
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
  arrays,
  getAvailableLanguages,
  PreferenceService,
  replaceLocalizePlaceholder,
  ThrottledDelayer,
  TerminalSettingsId,
} from '@opensumi/ide-core-browser';
import { SearchSettingId } from '@opensumi/ide-core-common/lib/settings/search';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { toPreferenceReadableName, PreferenceSettingId, getPreferenceItemLabel } from '../common';

import { PREFERENCE_COMMANDS } from './preference-contribution';

const { addElement } = arrays;
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

  private onDidSettingsChangeEmitter: Emitter<void> = new Emitter();

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

  get onDidSettingsChange() {
    return this.onDidSettingsChangeEmitter.event;
  }

  fireDidSettingsChange() {
    this.onDidSettingsChangeEmitter.fire();
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

  async hasThisScopeSetting(scope: PreferenceScope) {
    const url = await this.getPreferenceUrl(scope);
    if (!url) {
      return;
    }

    const exist = await this.fileServiceClient.access(url);
    return exist;
  }

  /**
   * 注册配置组
   * @param group 配置组
   */
  registerSettingGroup(group: ISettingGroup): IDisposable {
    const disposable = addElement(this.settingsGroups, group);
    this.fireDidSettingsChange();
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
    this.fireDidSettingsChange();
    return disposable;
  }

  visitSection(
    section: ISettingSection,
    cb: (v: string | IPreferenceViewDesc) => boolean | undefined,
  ): string | IPreferenceViewDesc | undefined {
    if (section.preferences) {
      for (const preference of section.preferences) {
        const result = cb(preference);
        if (result) {
          return preference;
        }
      }
    }
    if (section.subSettingSections && Array.isArray(section.subSettingSections)) {
      for (const subSec of section.subSettingSections) {
        return this.visitSection(subSec, cb);
      }
    }
  }

  /**
   * 通过配置项ID获取配置项展示信息
   * @param preferenceId 配置项ID
   */
  getSectionByPreferenceId(preferenceId: string) {
    const groups = this.settingsSections.values();
    for (const sections of groups) {
      for (const section of sections) {
        return this.visitSection(section, (preference) => {
          if (!isString(preference)) {
            if (preference.id === preferenceId) {
              return true;
            }
          }
        });
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
    const processSection = (section: Required<Pick<ISettingSection, 'preferences'>>) => {
      const preferences = section.preferences.filter((pref) => {
        if (this.filterPreferences(pref, scope)) {
          return false;
        }
        if (!search) {
          return true;
        }

        const prefId = typeof pref === 'string' ? pref : pref.id;
        const schema = this.schemaProvider.getPreferenceProperty(prefId);
        const prefLabel = typeof pref === 'string' ? toPreferenceReadableName(pref) : getPreferenceItemLabel(pref);
        const description = schema && replaceLocalizePlaceholder(schema.description);
        const markdownDescription = schema && replaceLocalizePlaceholder(schema.markdownDescription);
        return (
          this.isContainSearchValue(prefId, search) ||
          this.isContainSearchValue(prefLabel, search) ||
          (description && this.isContainSearchValue(description, search)) ||
          (markdownDescription && this.isContainSearchValue(markdownDescription, search))
        );
      });

      const grouped = groupBy(section.preferences, (v) => {
        if (v instanceof String) {
          return v;
        }
        return (v as IPreferenceViewDesc).id;
      });

      return {
        preferences,
        grouped,
      };
    };
    res.forEach((section) => {
      const sec = { ...section } as ISettingSection;

      if (section.preferences) {
        const { preferences } = processSection(section as Required<Pick<ISettingSection, 'preferences'>>);
        sec.preferences = preferences;
      }
      if (section.subSettingSections) {
        const subSettingSections = section.subSettingSections
          .map((v) => {
            const { preferences } = processSection(v as Required<Pick<ISettingSection, 'preferences'>>);
            if (preferences.length > 0) {
              return { ...v, preferences };
            }
          })
          .filter(Boolean) as ISettingSection[];
        sec.subSettingSections = subSettingSections;
      }

      if (
        (sec.preferences && sec.preferences.length > 0) ||
        (sec.subSettingSections && sec.subSettingSections.length > 0)
      ) {
        result.push(sec);
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
    id: PreferenceSettingId.View,
    title: '%settings.group.view%',
    iconClass: getIcon('detail'),
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
];

export const defaultSettingSections: {
  [key: string]: ISettingSection[];
} = {
  [PreferenceSettingId.General]: [
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
  [PreferenceSettingId.Editor]: [
    {
      title: 'Editor',
      preferences: [
        // 预览模式
        { id: 'editor.previewMode' },
        {
          id: 'editor.enablePreviewFromCodeNavigation',
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
        { id: 'editor.trimAutoWhitespace' },

        // 补全
        { id: 'editor.suggest.insertMode' },
        { id: 'editor.suggest.filterGraceful' },
        { id: 'editor.suggest.localityBonus' },
        { id: 'editor.suggest.shareSuggestSelections' },
        { id: 'editor.suggest.snippetsPreventQuickSuggestions' },
        { id: 'editor.suggest.showIcons' },
        { id: 'editor.suggest.maxVisibleSuggestions' },
        { id: 'editor.suggest.showMethods' },
        { id: 'editor.suggest.showFunctions' },
        { id: 'editor.suggest.showConstructors' },
        { id: 'editor.suggest.showFields' },
        { id: 'editor.suggest.showVariables' },
        { id: 'editor.suggest.showClasses' },
        { id: 'editor.suggest.showStructs' },
        { id: 'editor.suggest.showInterfaces' },
        { id: 'editor.suggest.showModules' },
        { id: 'editor.suggest.showProperties' },
        { id: 'editor.suggest.showEvents' },
        { id: 'editor.suggest.showOperators' },
        { id: 'editor.suggest.showUnits' },
        { id: 'editor.suggest.showValues' },
        { id: 'editor.suggest.showConstants' },
        { id: 'editor.suggest.showEnums' },
        { id: 'editor.suggest.showEnumMembers' },
        { id: 'editor.suggest.showKeywords' },
        { id: 'editor.suggest.showWords' },
        { id: 'editor.suggest.showColors' },
        { id: 'editor.suggest.showFiles' },
        { id: 'editor.suggest.showReferences' },
        { id: 'editor.suggest.showCustomcolors' },
        { id: 'editor.suggest.showFolders' },
        { id: 'editor.suggest.showTypeParameters' },
        { id: 'editor.suggest.showSnippets' },
        { id: 'editor.suggest.showUsers' },
        { id: 'editor.suggest.showIssues' },
        { id: 'editor.suggest.preview' },
        { id: 'editor.suggest.details.visible' },

        // Guides
        { id: 'editor.guides.bracketPairs', localized: 'preference.editor.guides.bracketPairs' },
        { id: 'editor.guides.indentation', localized: 'preference.editor.guides.indentation' },
        {
          id: 'editor.guides.highlightActiveIndentation',
          localized: 'preference.editor.guides.highlightActiveIndentation',
        },

        // 行内补全
        { id: 'editor.inlineSuggest.enabled', localized: 'preference.editor.inlineSuggest.enabled' },
        {
          id: 'editor.experimental.stickyScroll.enabled',
          localized: 'preference.editor.experimental.stickyScroll.enabled',
        },
        // 缩进
        { id: 'editor.detectIndentation', localized: 'preference.editor.detectIndentation' },
        { id: 'editor.tabSize', localized: 'preference.editor.tabSize' },
        { id: 'editor.insertSpaces', localized: 'preference.editor.insertSpace' },
        // 显示
        { id: 'editor.wrapTab', localized: 'preference.editor.wrapTab' },
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
        { id: 'editor.maxTokenizationLineLength', localized: 'preference.editor.maxTokenizationLineLength' },
        { id: 'editor.largeFile', localized: 'preference.editor.largeFile' },
        { id: 'editor.readonlyFiles', localized: 'preference.editor.readonlyFiles' },
        {
          id: 'editor.bracketPairColorization.enabled',
          localized: 'preference.editor.bracketPairColorization.enabled',
        },
        { id: 'workbench.editorAssociations' },
      ],
    },
    {
      title: 'Diff Editor',
      preferences: [
        // Diff 编辑器
        { id: 'diffEditor.renderSideBySide', localized: 'preference.diffEditor.renderSideBySide' },
        { id: 'diffEditor.ignoreTrimWhitespace', localized: 'preference.diffEditor.ignoreTrimWhitespace' },
      ],
    },
    {
      title: 'Files',
      preferences: [
        { id: 'files.autoGuessEncoding', localized: 'preference.files.autoGuessEncoding.title' },
        { id: 'files.encoding', localized: 'preference.files.encoding.title' },
        { id: 'files.eol' },
        { id: 'files.trimFinalNewlines' },
        { id: 'files.trimTrailingWhitespace' },
        { id: 'files.insertFinalNewline' },
        { id: 'files.exclude', localized: 'preference.files.exclude.title' },
        { id: 'files.watcherExclude', localized: 'preference.files.watcherExclude.title' },
        { id: 'files.associations', localized: 'preference.files.associations.title' },
      ],
    },
  ],
  // 整体布局相关的，比如 QuickOpen 也放这
  [PreferenceSettingId.View]: [
    {
      // 布局信息
      title: 'Layout',
      preferences: [{ id: 'view.saveLayoutWithWorkspace', localized: 'preference.view.saveLayoutWithWorkspace.title' }],
    },
    {
      title: 'File Tree',
      preferences: [],
    },
    {
      // 资源管理器
      title: 'Explorer',
      preferences: [
        { id: 'explorer.fileTree.baseIndent', localized: 'preference.explorer.fileTree.baseIndent.title' },
        { id: 'explorer.fileTree.indent', localized: 'preference.explorer.fileTree.indent.title' },
        { id: 'explorer.compactFolders', localized: 'preference.explorer.compactFolders.title' },
        { id: 'explorer.autoReveal', localized: 'preference.explorer.autoReveal' },
      ],
    },
    {
      title: 'QuickOpen',
      preferences: [{ id: 'workbench.quickOpen.preserveInput' }],
    },
    {
      title: 'Search',
      preferences: [
        // 搜索
        { id: SearchSettingId.Include },
        { id: SearchSettingId.Exclude, localized: 'preference.search.exclude.title' },
        { id: SearchSettingId.UseReplacePreview },
        // { id: 'search.maxResults' },
        { id: SearchSettingId.SearchOnType },
        { id: SearchSettingId.SearchOnTypeDebouncePeriod },
        // { id: 'search.showLineNumbers' },
        // { id: 'search.smartCase' },
        // { id: 'search.useGlobalIgnoreFiles' },
        // { id: 'search.useIgnoreFiles' },
        // { id: 'search.useParentIgnoreFiles' },

        // { id: 'search.quickOpen.includeHistory' },
        // { id: 'search.quickOpen.includeSymbols' },
      ],
    },
    {
      title: 'Output',
      preferences: [
        // 输出
        { id: 'output.maxChannelLine', localized: 'output.maxChannelLine' },
        { id: 'output.enableLogHighlight', localized: 'output.enableLogHighlight' },
        { id: 'output.enableSmartScroll', localized: 'output.enableSmartScroll' },
      ],
    },
    {
      title: 'Debug',
      preferences: [
        // 调试
        // 由于筛选器的匹配模式搜索存在性能、匹配难度大等问题，先暂时隐藏
        // { id: 'debug.console.filter.mode', localized: 'preference.debug.console.filter.mode' },
        { id: 'debug.console.wordWrap', localized: 'preference.debug.console.wordWrap' },
        { id: 'debug.inline.values', localized: 'preference.debug.inline.values' },
        { id: 'debug.toolbar.float', localized: 'preference.debug.toolbar.float.title' },
      ],
    },
  ],
  [PreferenceSettingId.Terminal]: [
    {
      preferences: [
        // 终端类型
        { id: TerminalSettingsId.Type, localized: 'preference.terminal.type' },
        // 字体
        { id: TerminalSettingsId.FontFamily, localized: 'preference.terminal.fontFamily' },
        { id: TerminalSettingsId.FontSize, localized: 'preference.terminal.fontSize' },
        { id: TerminalSettingsId.FontWeight, localized: 'preference.terminal.fontWeight' },
        { id: TerminalSettingsId.LineHeight, localized: 'preference.terminal.lineHeight' },
        // 光标
        { id: TerminalSettingsId.CursorBlink, localized: 'preference.terminal.cursorBlink' },
        // 显示
        { id: TerminalSettingsId.Scrollback, localized: 'preference.terminal.scrollback' },
        // 命令行参数
        { id: 'terminal.integrated.shellArgs.linux', localized: 'preference.terminal.integrated.shellArgs.linux' },
        { id: 'terminal.integrated.copyOnSelection', localized: 'preference.terminal.integrated.copyOnSelection' },
        // Local echo
        { id: 'terminal.integrated.localEchoEnabled', localized: 'preference.terminal.integrated.localEchoEnabled' },
        {
          id: 'terminal.integrated.localEchoLatencyThreshold',
          localized: 'preference.terminal.integrated.localEchoLatencyThreshold',
        },
        {
          id: 'terminal.integrated.localEchoExcludePrograms',
          localized: 'preference.terminal.integrated.localEchoExcludePrograms',
        },
        {
          id: 'terminal.integrated.cursorStyle',
          localized: 'preference.terminal.integrated.cursorStyle',
        },
        { id: 'terminal.integrated.localEchoStyle', localized: 'preference.terminal.integrated.localEchoStyle' },
      ],
    },
  ],
  [PreferenceSettingId.Feature]: [
    {
      title: 'Misc',
      preferences: [],
    },
    {
      // 树/列表项
      title: 'Tree Component',
      preferences: [{ id: 'workbench.list.openMode', localized: 'preference.workbench.list.openMode.title' }],
    },
  ],
};
