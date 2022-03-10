import { observable, transaction, action } from 'mobx';
import React from 'react';
import { createRef } from 'react';

/**
 * 用于文件内容搜索
 */

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { VALIDATE_TYPE, ValidateMessage } from '@opensumi/ide-components';
import {
  Key,
  URI,
  Schemas,
  IDisposable,
  CommandService,
  COMMON_COMMANDS,
  RecentStorage,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import { GlobalBrowserStorageService } from '@opensumi/ide-core-browser/lib/services/storage-service';
import {
  Emitter,
  IEventBus,
  trim,
  isUndefined,
  localize,
  IReporterService,
  IReporterTimer,
  REPORT_NAME,
} from '@opensumi/ide-core-common';
import * as arrays from '@opensumi/ide-core-common/lib/arrays';
import { parse, ParsedPattern } from '@opensumi/ide-core-common/lib/utils/glob';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelService,
  IEditorDocumentModel,
  EditorDocumentModelContentChangedEvent,
  IEditorDocumentModelContentChangedEventPayload,
} from '@opensumi/ide-editor/lib/browser';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';


import {
  ContentSearchResult,
  SEARCH_STATE,
  ContentSearchOptions,
  IContentSearchServer,
  ContentSearchServerPath,
  ResultTotal,
  SendClientResult,
  anchorGlob,
  IContentSearchClientService,
  IUIState,
  cutShortSearchResult,
  FilterFileWithGlobRelativePath,
  DEFAULT_SEARCH_IN_WORKSPACE_LIMIT,
} from '../common';

import { replaceAll } from './replace';
import { SearchContextKey } from './search-contextkey';
import { SearchHistory } from './search-history';
import { SearchPreferences } from './search-preferences';
import { SearchResultCollection } from './search-result-collection';

export interface SearchAllFromDocModelOptions {
  searchValue: string;
  searchOptions: ContentSearchOptions;
  documentModelManager: IEditorDocumentModelService;
  workbenchEditorService: WorkbenchEditorService;
  rootDirs: string[];
}

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

const resultTotalDefaultValue = Object.assign({}, { resultNum: 0, fileNum: 0 });

@Injectable()
export class ContentSearchClientService implements IContentSearchClientService {
  protected titleStateEmitter: Emitter<void> = new Emitter();
  protected eventBusDisposer: IDisposable;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(SearchPreferences)
  private readonly searchPreferences: SearchPreferences;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

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

  @Autowired(SearchContextKey)
  private readonly searchContextKey: SearchContextKey;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  workbenchEditorService: WorkbenchEditorService;

  @observable
  replaceValue = '';
  @observable
  searchValue = '';
  @observable
  includeValue = '';
  @observable
  excludeValue = '';
  @observable
  searchError = '';
  @observable
  searchState: SEARCH_STATE;
  @observable
  UIState: IUIState = {
    isSearchFocus: false,
    isToggleOpen: true,
    isDetailOpen: false,

    // Search Options
    isMatchCase: false,
    isWholeWord: false,
    isUseRegexp: false,
    isIncludeIgnored: false,
    isOnlyOpenEditors: false,
  };
  @observable
  searchResults: Map<string, ContentSearchResult[]> = observable.map();
  @observable
  resultTotal: ResultTotal = resultTotalDefaultValue;
  // Replace state
  @observable
  isReplaceDoing = false;

  @observable
  isSearchDoing = false;

  @observable
  isShowValidateMessage = true;

  @observable
  isExpandAllResult = true;

  _searchHistory: SearchHistory;

  docModelSearchedList: string[] = [];
  currentSearchId = -1;

  searchInputEl = createRef<HTMLInputElement>();
  replaceInputEl = createRef<HTMLInputElement>();

  searchResultCollection: SearchResultCollection = new SearchResultCollection();

  private reporter: { timer: IReporterTimer; value: string } | null = null;

  constructor() {
    this.setDefaultIncludeValue();
    this.recoverUIState();
  }

  search = (e?: React.KeyboardEvent | React.MouseEvent, insertUIState?: IUIState) => {
    const state = insertUIState || this.UIState;
    const value = this.searchValue;
    const searchOptions: ContentSearchOptions = {
      maxResults: 2000,
      matchCase: state.isMatchCase,
      matchWholeWord: state.isWholeWord,
      useRegExp: state.isUseRegexp,
      includeIgnored: state.isIncludeIgnored,

      include: splitOnComma(this.includeValue || ''),
      exclude: splitOnComma(this.excludeValue || ''),
    };

    searchOptions.exclude = this.getExcludeWithSetting(searchOptions);

    if (e && (e as any).keyCode !== undefined && Key.ENTER.keyCode !== (e as any).keyCode) {
      return;
    }
    if (!value) {
      return this.cleanOldSearch();
    }

    if (!this.workbenchEditorService) {
      this.workbenchEditorService = this.injector.get(WorkbenchEditorService);
    }

    // 记录搜索历史
    this.searchHistory.setSearchHistory(value);

    this.isShowValidateMessage = true;

    this.isExpandAllResult = true;

    // Stop old search
    if (this.currentSearchId) {
      this.contentSearchServer.cancel(this.currentSearchId);
      this.cleanOldSearch();
      this.currentSearchId = this.currentSearchId + 1;
      this.reporter = null;
    }
    let rootDirs: string[] = [];
    this.workspaceService.tryGetRoots().forEach((stat) => {
      const uri = new URI(stat.uri);
      if (uri.scheme !== Schemas.file) {
        return;
      }
      return rootDirs.push(uri.toString());
    });

    // 由于查询的限制，暂时只支持单一 workspace 的编码参数
    searchOptions.encoding = this.preferenceService.get<string>('files.encoding', undefined, rootDirs[0]?.toString());

    // FIXME: 当前无法在不同根目录内根据各自 include 搜素，因此如果多 workspaceFolders，此处可能返回比实际要多的结果
    // 同时 searchId 设计原因只能针对单服务，多个 search 服务无法对同一个 searchId 返回结果
    // 长期看需要改造，以支持 registerFileSearchProvider
    if (this.UIState.isOnlyOpenEditors) {
      rootDirs = [];
      const openResources = arrays.coalesce(
        arrays.flatten(this.workbenchEditorService.editorGroups.map((group) => group.resources)),
      );
      const includeMatcherList = searchOptions.include?.map((str) => parse(anchorGlob(str))) || [];
      const excludeMatcherList = searchOptions.exclude?.map((str) => parse(anchorGlob(str))) || [];
      const openResourcesInFilter = openResources.filter((resource) => {
        const uriString = resource.uri.toString();
        if (excludeMatcherList.length > 0 && excludeMatcherList.some((matcher) => matcher(uriString))) {
          return false;
        }
        if (includeMatcherList.length > 0 && !includeMatcherList.some((matcher) => matcher(uriString))) {
          return false;
        }
        return true;
      });
      const include: string[] = [];
      const isAbsolutePath = (resource: URI): boolean => !!resource.codeUri.path && resource.codeUri.path[0] === '/';
      openResourcesInFilter.forEach(({ uri }) => {
        if (uri.scheme === Schemas.walkThrough) {
          return;
        }
        if (isAbsolutePath(uri)) {
          const searchRoot = this.workspaceService.getWorkspaceRootUri(uri) ?? uri.withPath(uri.path.dir);
          const relPath = searchRoot.path.relative(uri.path);
          rootDirs.push(searchRoot.toString());
          if (relPath) {
            include.push(`./${relPath.toString()}`);
          }
        } else if (uri.codeUri.fsPath) {
          include.push(uri.codeUri.fsPath);
        }
      });
      searchOptions.include = include;
      searchOptions.exclude = include.length ? undefined : ['**/*'];
    }

    // 从 doc model 中搜索
    const searchFromDocModelInfo = this.searchAllFromDocModel({
      searchValue: value,
      searchOptions,
      documentModelManager: this.documentModelManager,
      workbenchEditorService: this.workbenchEditorService,
      rootDirs,
    });

    // 从服务端搜索
    this.reporter = { timer: this.reporterService.time(REPORT_NAME.SEARCH_MEASURE), value };
    this.contentSearchServer.search(value, rootDirs, searchOptions).then((id) => {
      this.currentSearchId = id;
      this._onSearchResult({
        id,
        data: searchFromDocModelInfo.result,
        searchState: SEARCH_STATE.doing,
        docModelSearchedList: searchFromDocModelInfo.searchedList,
      });
    });

    transaction(() => {
      this.watchDocModelContentChange(searchOptions, rootDirs);
    });
  };

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

      if (!this.searchResults || this.isReplaceDoing) {
        return;
      }

      // 只搜索file协议内容
      if (event.uri.scheme !== Schemas.file) {
        return;
      }

      const uriString = event.uri.toString();

      const docModel = this.documentModelManager.getModelReference(event.uri);
      if (!docModel) {
        return;
      }
      const resultData = this.searchFromDocModel(searchOptions, docModel.instance, this.searchValue, rootDirs);

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
        return;
      } else if (resultData.result.length !== oldResults!.length) {
        // 搜索结果变多了，更新数据
        this.resultTotal.resultNum = this.resultTotal.resultNum - oldResults!.length + resultData.result.length;
      }
      if (resultData.result.length > 0) {
        // 更新结果树
        this.searchResults.set(uriString, resultData.result);
      }
    });
  }

  cleanOldSearch() {
    this.docModelSearchedList = [];
    this.searchResults.clear();
    this.resultTotal = resultTotalDefaultValue;
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

  _onSearchResult(sendClientResult: SendClientResult) {
    const { id, data, searchState, error, docModelSearchedList } = sendClientResult;

    if (!data) {
      return;
    }

    if (id > this.currentSearchId) {
      // 新的搜索开始了
      this.isSearchDoing = true;
      this.currentSearchId = id;
      this.cleanOldSearch();
    }

    if (this.currentSearchId && this.currentSearchId > id) {
      // 若存在异步发送的上次搜索结果，丢弃上次搜索的结果
      return;
    }

    if (searchState) {
      this.searchState = searchState;
      if (searchState === SEARCH_STATE.done || searchState === SEARCH_STATE.error) {
        // 搜索结束清理ID
        this.isSearchDoing = false;
        this.currentSearchId = -1;
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
      this.isSearchDoing = false;
      this.searchError = error.toString();
      this.reporter = null;
    }

    transaction(() => {
      this.mergeSameUriResult(data, this.searchResults!, this.docModelSearchedList, this.resultTotal);
    });

    if (docModelSearchedList) {
      // 记录通 docModel 搜索过的文件，用于过滤服务端搜索的重复内容
      this.docModelSearchedList = docModelSearchedList;
    }
    this.titleStateEmitter.fire();
  }

  focus() {
    window.requestAnimationFrame(() => {
      if (!this.searchInputEl || !this.searchInputEl.current) {
        return;
      }
      this.searchInputEl.current.focus();
      if (this.searchValue !== '') {
        this.searchInputEl.current.select();
      }
    });
  }

  refresh() {
    this.search();
  }

  refreshIsEnable() {
    return !!(this.searchState !== SEARCH_STATE.doing && this.searchValue);
  }

  clean() {
    this.searchValue = '';
    this.searchResults.clear();
    this.resultTotal = { fileNum: 0, resultNum: 0 };
    this.searchState = SEARCH_STATE.todo;
    this.searchValue = '';
    this.replaceValue = '';
    this.excludeValue = '';
    this.includeValue = '';
    this.titleStateEmitter.fire();
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

  onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.searchValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
    this.isShowValidateMessage = false;
  };

  onReplaceInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.replaceValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
  };

  onSearchExcludeChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.excludeValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
  };

  onSearchIncludeChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.includeValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
  };

  setSearchValueFromActivatedEditor = () => {
    if (!this.workbenchEditorService) {
      this.workbenchEditorService = this.injector.get(WorkbenchEditorService);
    }

    const currentEditor = this.workbenchEditorService.currentEditor;
    if (currentEditor) {
      const selections = currentEditor.getSelections();
      if (selections && selections.length > 0 && currentEditor.currentDocumentModel) {
        const { selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn } = selections[0];
        const selectionText = currentEditor.currentDocumentModel.getText(
          new monaco.Range(selectionStartLineNumber, selectionStartColumn, positionLineNumber, positionColumn),
        );

        const searchText = trim(selectionText) === '' ? this.searchValue : selectionText;
        this.searchValue = searchText;
      }
    }
  };

  get onTitleStateChange() {
    return this.titleStateEmitter.event;
  }

  private shouldSearch = (uiState: Partial<typeof this.UIState>) =>
    uiState.isWholeWord ||
    uiState.isMatchCase ||
    uiState.isUseRegexp ||
    uiState.isIncludeIgnored ||
    uiState.isOnlyOpenEditors;

  updateUIState = (obj: Partial<typeof this.UIState>, e?: React.KeyboardEvent | React.MouseEvent) => {
    if (!isUndefined(obj.isSearchFocus) && obj.isSearchFocus !== this.UIState.isSearchFocus) {
      this.searchContextKey.searchInputFocused.set(obj.isSearchFocus);
      // 搜索框状态发现变化，重置搜索历史的当前位置
      this.searchHistory.reset();
      this.isShowValidateMessage = false;
    }
    const newUIState = Object.assign({}, this.UIState, obj);
    this.UIState = newUIState;
    this.browserStorageService.setData('search.UIState', newUIState);
    if (!this.shouldSearch(obj)) {
      return;
    }
    this.search(e, newUIState);
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

  @action.bound
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

  doReplaceAll = () => {
    if (this.isReplaceDoing) {
      return;
    }
    this.isReplaceDoing = true;
    replaceAll(
      this.workspaceEditService,
      this.searchResults,
      this.replaceValue || '',
      this.dialogService,
      this.messageService,
      this.resultTotal,
    ).then((isDone) => {
      this.isReplaceDoing = false;
      if (!isDone) {
        return;
      }
      this.search();
    });
  };

  dispose() {
    this.titleStateEmitter.dispose();
  }

  private async recoverUIState() {
    const UIState = (await this.browserStorageService.getData('search.UIState')) as IUIState | undefined;
    this.updateUIState(UIState || {});
  }

  private getExcludeWithSetting(searchOptions: ContentSearchOptions) {
    let result: string[] = [];

    if (searchOptions.exclude) {
      result = result.concat(searchOptions.exclude);
    }

    // 启用默认排除项
    if (!this.UIState.isIncludeIgnored) {
      result = result.concat(this.getPreferenceSearchExcludes());
    }

    return result;
  }

  private setDefaultIncludeValue() {
    const searchIncludes = this.searchPreferences['search.include'] || {};
    this.includeValue = Object.keys(searchIncludes)
      .reduce<string[]>((includes, key) => {
        if (searchIncludes[key]) {
          includes.push(key);
        }
        return includes;
      }, [])
      .join(',');
    // 如有 inlcude 填充，则显示搜索条件
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
    codeEditor?,
  ): {
    result: ContentSearchResult[];
    searchedList: string[];
  } {
    let matcherList: ParsedPattern[] = [];
    const uriString = docModel.uri.toString();
    const result: ContentSearchResult[] = [];
    const searchedList: string[] = [];

    if (searchOptions.include && searchOptions.include.length > 0) {
      // include 设置时，若匹配不到则返回空
      searchOptions.include.forEach((str: string) => {
        matcherList.push(parse(anchorGlob(str)));
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
        matcherList.push(parse(anchorGlob(str)));
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
        codeEditor.setSelection(find.range);
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

  private searchAllFromDocModel(options: SearchAllFromDocModelOptions): {
    result: ContentSearchResult[];
    searchedList: string[];
  } {
    const searchValue = options.searchValue;
    const searchOptions = options.searchOptions;
    const documentModelManager = options.documentModelManager;
    const workbenchEditorService = options.workbenchEditorService;
    const rootDirs = options.rootDirs;

    let result: ContentSearchResult[] = [];
    let searchedList: string[] = [];
    const docModels = documentModelManager.getAllModels();
    const group = workbenchEditorService.currentEditorGroup;
    const resources = group.resources;

    const filterFileWithGlobRelativePath = new FilterFileWithGlobRelativePath(rootDirs, searchOptions.include || []);

    docModels.forEach((docModel: IEditorDocumentModel) => {
      const uriString = docModel.uri.toString();

      // 只搜索file协议内容
      if (docModel.uri.scheme !== Schemas.file) {
        return;
      }

      if (!filterFileWithGlobRelativePath.test(uriString)) {
        return;
      }

      const data = this.searchFromDocModel(searchOptions, docModel, searchValue, rootDirs, group.codeEditor);

      result = result.concat(data.result);
      searchedList = searchedList.concat(data.searchedList);
    });

    return {
      result,
      searchedList,
    };
  }
}
