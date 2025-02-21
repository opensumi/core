import debounce from 'lodash/debounce';

import { Autowired, Injectable } from '@opensumi/di';
import { VALIDATE_TYPE, ValidateMessage } from '@opensumi/ide-components';
import {
  COMMON_COMMANDS,
  CommandService,
  Emitter,
  IDisposable,
  ParsedPattern,
  PreferenceService,
  RecentStorage,
  Schemes,
  URI,
  arrays,
  parseGlob,
  strings,
} from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import { GlobalBrowserStorageService } from '@opensumi/ide-core-browser/lib/services/storage-service';
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  IEventBus,
  IReporterService,
  IReporterTimer,
  REPORT_NAME,
  localize,
} from '@opensumi/ide-core-common';
import { SearchSettingId } from '@opensumi/ide-core-common/lib/settings/search';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorDocumentModelContentChangedEvent,
  ICodeEditor,
  IEditorDocumentModel,
  IEditorDocumentModelContentChangedEventPayload,
  IEditorDocumentModelService,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import {
  ContentSearchOptions,
  ContentSearchResult,
  ContentSearchServerPath,
  DEFAULT_SEARCH_IN_WORKSPACE_LIMIT,
  FilterFileWithGlobRelativePath,
  IContentSearchClientService,
  IContentSearchServer,
  IUIState,
  ResultTotal,
  SEARCH_STATE,
  SendClientResult,
  anchorGlob,
  cutShortSearchResult,
} from '../common';

import { replaceAll } from './replace';
import { SearchHistory } from './search-history';
import { SearchPreferences } from './search-preferences';
import { SearchResultCollection } from './search-result-collection';

export interface SearchAllFromDocModelOptions {
  searchValue: string;
  searchOptions: ContentSearchOptions;
  documentModelManager: IEditorDocumentModelService;
  rootDirs: string[];
}

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

/**
 * 用于文件内容搜索
 */
@Injectable()
export class ContentSearchClientService extends Disposable implements IContentSearchClientService {
  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(SearchPreferences)
  private readonly searchPreferences: SearchPreferences;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(ContentSearchServerPath)
  private readonly contentSearchServer: IContentSearchServer;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(RecentStorage)
  private readonly recentStorage: RecentStorage;

  @Autowired(IEditorDocumentModelService)
  private readonly documentModelManager: IEditorDocumentModelService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(GlobalBrowserStorageService)
  private readonly browserStorageService: GlobalBrowserStorageService;

  @Autowired(IDialogService)
  private readonly dialogService;

  @Autowired(IMessageService)
  private readonly messageService;

  @Autowired(IWorkspaceEditService)
  private readonly workspaceEditService: IWorkspaceEditService;

  @Autowired(IReporterService)
  private reporterService: IReporterService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired()
  private readonly resourceService: ResourceService;

  private onDidChangeEmitter: Emitter<void> = new Emitter();
  private onDidTitleChangeEmitter: Emitter<void> = new Emitter();
  private onDidUIStateChangeEmitter: Emitter<IUIState> = new Emitter();
  private onDidSearchStateChangeEmitter: Emitter<string> = new Emitter();

  protected eventBusDisposer: IDisposable;

  get onDidChange() {
    return this.onDidChangeEmitter.event;
  }

  get onDidTitleChange() {
    return this.onDidTitleChangeEmitter.event;
  }

  get onDidUIStateChange() {
    return this.onDidUIStateChangeEmitter.event;
  }

  get onDidSearchStateChange() {
    return this.onDidSearchStateChangeEmitter.event;
  }

  public UIState: IUIState = {
    isToggleOpen: true,
    isDetailOpen: false,
    // Search Options
    isMatchCase: false,
    isWholeWord: false,
    isUseRegexp: false,
    isIncludeIgnored: false,
    isOnlyOpenEditors: false,
  };

  public searchResults: Map<string, ContentSearchResult[]> = new Map();
  public searchError = '';
  public searchState: SEARCH_STATE;
  public resultTotal: ResultTotal = { resultNum: 0, fileNum: 0 };
  public isReplacing = false;
  public isSearching = false;
  public isShowValidateMessage = true;
  public replaceValue = '';
  public searchValue = '';
  public includeValue = '';
  public excludeValue = '';

  private _searchHistory: SearchHistory;
  private _docModelSearchedList: string[] = [];
  private _currentSearchId = -1;

  searchResultCollection: SearchResultCollection = new SearchResultCollection();

  private reporter: { timer: IReporterTimer; value: string } | null = null;

  private searchCancelToken: CancellationTokenSource;
  private searchOnType: boolean;

  public searchDebounce: () => void;

  constructor() {
    super();
    this.setDefaultIncludeValue();
    this.recoverUIState();

    this.searchOnType = this.searchPreferences[SearchSettingId.SearchOnType] || true;
    const timeout = this.searchPreferences[SearchSettingId.SearchOnTypeDebouncePeriod] || 300;
    this.searchDebounce = debounce(
      () => {
        this.search();
      },
      timeout,
      {
        trailing: true,
        maxWait: timeout * 5,
      },
    );
  }

  private searchId: number = new Date().getTime();

  public searchOnTyping() {
    if (this.searchOnType) {
      this.searchDebounce();
    }
  }

  async search(insertUIState?: IUIState) {
    const value = this.searchValue;
    this.cleanSearchResults();
    if (!value) {
      this.onDidChangeEmitter.fire();
      return;
    }
    if (this.searchCancelToken && !this.searchCancelToken.token.isCancellationRequested) {
      this.searchCancelToken.cancel();
    }

    this.searchCancelToken = new CancellationTokenSource();

    const state = insertUIState || this.UIState;

    await this.doSearch(value, state, this.searchCancelToken.token);
  }

  async doSearch(
    value: string,
    state: IUIState & { include?: string[]; exclude?: string[]; maxResults?: number },
    token: CancellationToken,
  ) {
    const searchOptions: ContentSearchOptions = {
      maxResults: state.maxResults || 2000,
      matchCase: state.isMatchCase,
      matchWholeWord: state.isWholeWord,
      useRegExp: state.isUseRegexp,
      includeIgnored: state.isIncludeIgnored,

      include: state.include || splitOnComma(this.includeValue || ''),
      exclude: state.exclude || splitOnComma(this.excludeValue || ''),
    };

    searchOptions.exclude = this.getExcludeWithSetting(searchOptions, state);

    // 记录搜索历史
    this.searchHistory.setSearchHistory(value);

    this.isShowValidateMessage = true;

    // Stop old search
    this.isSearching = true;
    if (this._currentSearchId > -1) {
      this.contentSearchServer.cancel(this._currentSearchId);
      this._currentSearchId = this._currentSearchId + 1;
      this.reporter = null;
    }

    const rootDirSet = new Set<string>();
    this.workspaceService.tryGetRoots().forEach((stat) => {
      const uri = new URI(stat.uri);
      if (uri.scheme !== Schemes.file) {
        return;
      }
      rootDirSet.add(uri.toString());
    });

    // 由于查询的限制，暂时只支持单一 workspace 的编码参数
    searchOptions.encoding = this.preferenceService.get<string>(
      'files.encoding',
      undefined,
      rootDirSet.values().next()?.value,
    );

    // FIXME: 当前无法在不同根目录内根据各自 include 搜索，因此如果多 workspaceFolders，此处返回的结果仅为一部分
    // 同时 searchId 设计原因只能针对单服务，多个 search 服务无法对同一个 searchId 返回结果
    // 长期看需要改造，以支持 registerFileSearchProvider
    if (state.isOnlyOpenEditors) {
      rootDirSet.clear();
      const openResources = arrays.coalesce(
        arrays.flatten(this.workbenchEditorService.editorGroups.map((group) => group.resources)),
      );
      const includeMatcherList = searchOptions.include?.map((str) => parseGlob(anchorGlob(str))) || [];
      const excludeMatcherList = searchOptions.exclude?.map((str) => parseGlob(anchorGlob(str))) || [];
      const openResourcesInFilter = openResources.filter((resource) => {
        const fsPath = resource.uri.path.toString();
        if (excludeMatcherList.length > 0 && excludeMatcherList.some((matcher) => matcher(fsPath))) {
          return false;
        }
        if (includeMatcherList.length > 0 && !includeMatcherList.some((matcher) => matcher(fsPath))) {
          return false;
        }
        return true;
      });
      const include: string[] = [];
      const isAbsolutePath = (resource: URI): boolean => !!resource.codeUri.path && resource.codeUri.path[0] === '/';
      openResourcesInFilter.forEach(({ uri }) => {
        if (uri.scheme === Schemes.walkThrough) {
          return;
        }
        if (isAbsolutePath(uri)) {
          const searchRoot = this.workspaceService.getWorkspaceRootUri(uri) ?? uri.withPath(uri.path.dir);
          const relPath = searchRoot.path.relative(uri.path);
          rootDirSet.add(searchRoot.toString());
          if (relPath) {
            include.push(`./${relPath.toString()}`);
          }
        } else if (uri.codeUri.fsPath) {
          include.push(uri.codeUri.fsPath);
        }
      });

      searchOptions.include = include;
      searchOptions.exclude = include.length > 0 ? undefined : ['**/*'];
    }
    const rootDirs = Array.from(rootDirSet);
    // 从 doc model 中搜索
    const searchFromDocModelInfo = await this.searchAllFromDocModel({
      searchValue: value,
      searchOptions,
      documentModelManager: this.documentModelManager,
      rootDirs,
    });
    if (token.isCancellationRequested) {
      this.isSearching = false;
      return;
    }
    this._currentSearchId = this.searchId++;

    // 从服务端搜索
    this.reporter = { timer: this.reporterService.time(REPORT_NAME.SEARCH_MEASURE), value };
    this.contentSearchServer.search(this._currentSearchId, value, rootDirs, searchOptions).then((id) => {
      if (token.isCancellationRequested) {
        return;
      }
      this._onSearchResult({
        id,
        data: searchFromDocModelInfo.result,
        searchState: SEARCH_STATE.doing,
        docModelSearchedList: searchFromDocModelInfo.searchedList,
      });
    });

    this.watchDocModelContentChange(searchOptions, rootDirs);
  }

  // #region 操作对当前打开的文档的搜索内容的 selection
  private EMPTY_SELECTION = new monaco.Range(0, 0, 0, 0);
  private lastEditor?: ICodeEditor;
  private lastSelection?: monaco.Range;
  setEditorSelections(editor: ICodeEditor, selections: monaco.Range) {
    // 清除上一个 editor 的 selection
    this.lastEditor?.setSelection(this.EMPTY_SELECTION);

    this.lastEditor = editor;
    this.lastSelection = selections;
    this.applyEditorSelections();
  }
  /**
   * 会在 tabbar 被选中时调用
   */
  applyEditorSelections() {
    if (this.lastEditor && this.lastSelection) {
      this.lastEditor.setSelection(this.lastSelection);
    }
  }
  /**
   * 会在 tabbar blur 和清除搜索结果时调用
   * @param clearEditor 是否清除上次选中的 editor（在重置搜索内容时调用）
   */
  clearEditorSelections(clearEditor = false) {
    if (this.lastEditor) {
      this.lastEditor.setSelection(this.EMPTY_SELECTION);
    }
    if (clearEditor) {
      this.lastSelection = undefined;
      this.lastEditor = undefined;
    }
  }
  // #endregion

  /**
   * 监听正在编辑文件变化，并同步结果
   * @param searchOptions
   * @param rootDirs
   */
  watchDocModelContentChange(searchOptions: ContentSearchOptions, rootDirs: string[]) {
    if (this.eventBusDisposer) {
      this.eventBusDisposer.dispose();
    }
    this.eventBusDisposer = this.eventBus.on(EditorDocumentModelContentChangedEvent, (data) => {
      const event: IEditorDocumentModelContentChangedEventPayload = data.payload;

      if (!this.searchResults || this.isReplacing) {
        return;
      }

      // 只搜索file协议内容
      if (event.uri.scheme !== Schemes.file) {
        return;
      }

      const uriString = event.uri.toString();

      const docModelRef = this.documentModelManager.getModelReference(event.uri);
      if (!docModelRef) {
        return;
      }
      const resultData = this.searchFromDocModel(searchOptions, docModelRef.instance, this.searchValue, rootDirs);

      const oldResults = this.searchResults.get(uriString);

      if (!oldResults) {
        // 不在结果树中，新增结果
        if (resultData.result.length > 0) {
          this.resultTotal.fileNum++;
          this.resultTotal.resultNum = this.resultTotal.resultNum + resultData.result.length;
        }
      } else if (resultData.result.length < 1) {
        // 搜索结果被删除完了，清理结果树
        this.searchResults.delete(uriString);
        this.resultTotal.fileNum = this.resultTotal.fileNum - 1;
        this.resultTotal.resultNum = this.resultTotal.resultNum - oldResults.length;
      } else if (resultData.result.length !== oldResults?.length) {
        // 搜索结果变多了，更新数据
        this.resultTotal.resultNum = this.resultTotal.resultNum - oldResults!.length + resultData.result.length;
      }

      if (resultData.result.length > 0) {
        // 更新结果树
        this.searchResults.set(uriString, resultData.result);
      }

      this.onDidChangeEmitter.fire();
      docModelRef.dispose();
    });
  }

  cleanSearchResults() {
    this._docModelSearchedList = [];
    this.searchResults.clear();
    this.resultTotal = { resultNum: 0, fileNum: 0 };
    this.clearEditorSelections(true);
  }

  /**
   * 服务端发送搜索结果过来
   * @param sendClientResult
   */
  onSearchResult(sendClientResult: SendClientResult) {
    const resultList = this.searchResultCollection.pushAndGetResultList(sendClientResult);
    resultList.forEach((result) => {
      this._onSearchResult(result);
    });
  }

  private _onSearchResult(sendClientResult: SendClientResult) {
    const { id, data, searchState, error, docModelSearchedList } = sendClientResult;

    if (!data) {
      return;
    }

    if (id > this._currentSearchId) {
      this.isSearching = true;
      this._currentSearchId = id;
      this.cleanSearchResults();
    }

    if (this._currentSearchId && this._currentSearchId > id) {
      // 若存在异步发送的上次搜索结果，丢弃上次搜索的结果
      return;
    }

    if (searchState) {
      this.searchState = searchState;
      if (searchState === SEARCH_STATE.done || searchState === SEARCH_STATE.error) {
        // 搜索结束清理ID
        this.isSearching = false;
        this._currentSearchId = -1;
      }

      if (searchState === SEARCH_STATE.done && this.reporter) {
        const { timer, value } = this.reporter;
        timer.timeEnd(value, {
          ...this.resultTotal,
        });
        this.reporter = null;
      }
    }

    if (error) {
      // 搜索出错
      this.isSearching = false;
      this.searchError = error.toString();
      this.reporter = null;
    }

    this.mergeSameUriResult(data, this.searchResults, this._docModelSearchedList, this.resultTotal);

    if (docModelSearchedList) {
      // 记录通 docModel 搜索过的文件，用于过滤服务端搜索的重复内容
      this._docModelSearchedList = docModelSearchedList;
    }
    this.onDidChangeEmitter.fire();
  }

  focus() {
    window.requestAnimationFrame(() => {
      this.onDidSearchStateChangeEmitter.fire(this.searchValue);
      this.applyEditorSelections();
    });
  }

  blur() {
    this.clearEditorSelections();
  }

  refreshIsEnable() {
    return !!(this.searchState !== SEARCH_STATE.doing && this.searchValue);
  }

  initSearchHistory() {
    return this.searchHistory.initSearchHistory();
  }

  setBackRecentSearchWord() {
    return this.searchHistory.setBackRecentSearchWord();
  }

  setRecentSearchWord() {
    return this.searchHistory.setRecentSearchWord();
  }

  clean() {
    this.searchResults.clear();
    this.resultTotal = { resultNum: 0, fileNum: 0 };
    this.searchState = SEARCH_STATE.todo;
    this.searchValue = '';
    this.replaceValue = '';
    this.excludeValue = '';
    this.includeValue = '';
    this.searchError = '';
  }

  cleanIsEnable() {
    return !!(
      this.searchValue ||
      this.replaceValue ||
      this.excludeValue ||
      this.includeValue ||
      this.searchError ||
      (this.searchResults && this.searchResults.size > 0)
    );
  }

  foldIsEnable() {
    return !!(this.searchResults && this.searchResults.size > 0);
  }

  onSearchInputChange = (text: string) => {
    this.searchValue = text;
    this.isShowValidateMessage = false;
    this.searchOnTyping();
  };

  onReplaceInputChange = (text: string) => {
    this.replaceValue = text;
  };

  onSearchExcludeChange = (text: string) => {
    this.excludeValue = text;
    this.searchOnTyping();
  };

  onSearchIncludeChange = (text: string) => {
    this.includeValue = text;
    this.searchOnTyping();
  };

  searchEditorSelection = () => {
    const currentEditor = this.workbenchEditorService.currentOrPreviousFocusedEditor;
    if (currentEditor) {
      const selections = currentEditor.getSelections();
      if (selections && selections.length > 0 && currentEditor.currentDocumentModel) {
        const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selections[0];
        const selectionText = currentEditor.currentDocumentModel.getText(
          new monaco.Range(selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn),
        );

        const searchText = strings.trim(selectionText) === '' ? this.searchValue : selectionText;
        this.searchValue = searchText;
      }
    }
  };

  private shouldSearch = (uiState: Partial<typeof this.UIState>) =>
    ['isWholeWord', 'isMatchCase', 'isUseRegexp', 'isIncludeIgnored', 'isOnlyOpenEditors'].some(
      (v) => uiState[v] !== undefined && uiState[v] !== this.UIState[v],
    );

  updateUIState = (obj: Partial<typeof this.UIState>) => {
    const newUIState = Object.assign({}, this.UIState, obj);

    if (this.shouldSearch(obj)) {
      this.search(newUIState);
    }

    this.UIState = newUIState;
    this.onDidUIStateChangeEmitter.fire(newUIState);
    this.browserStorageService.setData('search.UIState', newUIState);
  };

  getPreferenceSearchExcludes(): string[] {
    const excludes: string[] = [];
    const fileExcludes = this.corePreferences['files.exclude'];
    const searchExcludes = this.searchPreferences['search.exclude'];
    const allExcludes = Object.assign({}, fileExcludes, searchExcludes);
    for (const key of Object.keys(allExcludes)) {
      if (allExcludes[key]) {
        excludes.push(key);
      }
    }
    return excludes;
  }

  openPreference() {
    this.commandService.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id, 'files.watcherExclude');
  }

  get searchHistory(): SearchHistory {
    if (!this._searchHistory) {
      this._searchHistory = new SearchHistory(this, this.recentStorage);
    }
    return this._searchHistory;
  }

  get validateMessage(): ValidateMessage | undefined {
    if (this.resultTotal.resultNum >= DEFAULT_SEARCH_IN_WORKSPACE_LIMIT) {
      return {
        message: localize('search.too.many.results'),
        type: VALIDATE_TYPE.WARNING,
      };
    }
  }

  replaceAll = () => {
    if (this.isReplacing) {
      return;
    }
    this.isReplacing = true;
    replaceAll(
      this.documentModelManager,
      this.workspaceEditService,
      this.searchResults,
      this.replaceValue,
      this.searchValue,
      this.UIState.isUseRegexp,
      this.dialogService,
      this.messageService,
      this.resultTotal,
    ).then((isDone) => {
      this.isReplacing = false;
      if (!isDone) {
        return;
      }
      this.search();
    });
  };

  private async recoverUIState() {
    const UIState = (await this.browserStorageService.getData('search.UIState')) as IUIState | undefined;
    this.updateUIState(UIState || {});
  }

  private getExcludeWithSetting(searchOptions: ContentSearchOptions, state: IUIState) {
    let result: string[] = [];

    if (searchOptions.exclude) {
      result = result.concat(searchOptions.exclude);
    }

    // 启用默认排除项
    if (!state.isIncludeIgnored) {
      result = result.concat(this.getPreferenceSearchExcludes());
    }

    return result;
  }

  private setDefaultIncludeValue() {
    const searchIncludes = this.searchPreferences[SearchSettingId.Include] || {};
    this.includeValue = Object.keys(searchIncludes)
      .reduce<string[]>((includes, key) => {
        if (searchIncludes[key]) {
          includes.push(key);
        }
        return includes;
      }, [])
      .join(',');
    // 如有 include 填充，则显示搜索条件
    if (this.includeValue) {
      this.updateUIState({ isDetailOpen: true });
    }
  }

  private mergeSameUriResult(
    data: ContentSearchResult[],
    searchResultMap: Map<string, ContentSearchResult[]>,
    docSearchedList: string[],
    total?: ResultTotal,
  ) {
    const theTotal = total || { fileNum: 0, resultNum: 0 };
    data.forEach((result: ContentSearchResult) => {
      const oldData: ContentSearchResult[] | undefined = searchResultMap.get(result.fileUri);
      if (docSearchedList.indexOf(result.fileUri) > -1) {
        // 通过docModel搜索过的文件不再搜索
        return;
      }
      if (oldData) {
        oldData.push(result);
        searchResultMap.set(result.fileUri, oldData);
        theTotal.resultNum++;
      } else {
        searchResultMap.set(result.fileUri, [result]);
        theTotal.fileNum++;
        theTotal.resultNum++;
      }
    });

    return {
      searchResultMap,
      total: theTotal,
    };
  }

  private searchFromDocModel(
    searchOptions: ContentSearchOptions,
    docModel: IEditorDocumentModel,
    searchValue: string,
    rootDirs: string[],
    codeEditor?: ICodeEditor,
  ): {
    result: ContentSearchResult[];
    searchedList: string[];
  } {
    let matcherList: ParsedPattern[] = [];
    const uriString = docModel.uri.toString();

    const result: ContentSearchResult[] = [];
    const searchedList: string[] = [];
    if (!rootDirs.some((root) => uriString.startsWith(root))) {
      return {
        result,
        searchedList,
      };
    }
    if (searchOptions.include && searchOptions.include.length > 0) {
      // include 设置时，若匹配不到则返回空
      searchOptions.include.forEach((str: string) => {
        matcherList.push(parseGlob(anchorGlob(str)));
      });
      const isInclude = matcherList.some((matcher) => matcher(uriString));
      matcherList = [];
      if (!isInclude) {
        return {
          result,
          searchedList,
        };
      }
    }

    if (searchOptions.exclude && searchOptions.exclude.length > 0) {
      // exclude 设置时，若匹配到则返回空
      searchOptions.exclude.forEach((str: string) => {
        matcherList.push(parseGlob(anchorGlob(str)));
      });

      const isExclude = matcherList.some((matcher) => matcher(uriString));
      matcherList = [];
      if (isExclude) {
        return {
          result,
          searchedList,
        };
      }
    }

    const textModel = docModel.getMonacoModel();
    searchedList.push(docModel.uri.toString());
    const findResults = textModel.findMatches(
      searchValue,
      true,
      !!searchOptions.useRegExp,
      !!searchOptions.matchCase,
      searchOptions.matchWholeWord ? '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/? \n' : null,
      false,
    );
    findResults.forEach((find: monaco.editor.FindMatch, index) => {
      if (index === 0 && codeEditor) {
        // 给打开文件添加选中状态
        this.setEditorSelections(codeEditor, find.range);
      }
      result.push(
        cutShortSearchResult({
          fileUri: docModel.uri.toString(),
          line: find.range.startLineNumber,
          matchStart: find.range.startColumn,
          matchLength: find.range.endColumn - find.range.startColumn,
          lineText: textModel.getLineContent(find.range.startLineNumber),
        }),
      );
    });

    return {
      result,
      searchedList,
    };
  }

  private async searchAllFromDocModel(options: SearchAllFromDocModelOptions): Promise<{
    result: ContentSearchResult[];
    searchedList: string[];
  }> {
    const searchValue = options.searchValue;
    const searchOptions = options.searchOptions;
    const documentModelManager = options.documentModelManager;
    const rootDirs = options.rootDirs;

    let result: ContentSearchResult[] = [];
    let searchedList: string[] = [];
    const docModels = documentModelManager.getAllModels();
    const group = this.workbenchEditorService.currentEditorGroup;

    const filterFileWithGlobRelativePath = new FilterFileWithGlobRelativePath(rootDirs, searchOptions.include || []);

    await Promise.all(
      docModels.map(async (docModel: IEditorDocumentModel) => {
        const uriString = docModel.uri.toString();

        // 只搜索file协议内容
        if (docModel.uri.scheme !== Schemes.file) {
          return;
        }

        const resource = await this.resourceService.getResource(docModel.uri);
        if (!resource || resource.deleted) {
          return;
        }

        if (!filterFileWithGlobRelativePath.test(uriString)) {
          return;
        }

        const data = this.searchFromDocModel(searchOptions, docModel, searchValue, rootDirs, group.codeEditor);

        result = result.concat(data.result);
        searchedList = searchedList.concat(data.searchedList);
      }),
    );

    return {
      result,
      searchedList,
    };
  }

  fireTitleChange() {
    this.onDidTitleChangeEmitter.fire();
  }

  refresh() {
    this.search();
  }

  dispose() {
    super.dispose();
    this.eventBusDisposer?.dispose();
    this.blur();
  }
}
