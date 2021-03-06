import debounce from 'lodash/debounce';
import { observable, transaction, action } from 'mobx';
import React from 'react';
import { createRef } from 'react';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { VALIDATE_TYPE, ValidateMessage } from '@opensumi/ide-components';
import {
  Key,
  Schemes,
  CommandService,
  COMMON_COMMANDS,
  RecentStorage,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import {
  isUndefined,
  strings,
  parseGlob,
  ParsedPattern,
  Emitter,
  IDisposable,
  URI,
  arrays,
} from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import { GlobalBrowserStorageService } from '@opensumi/ide-core-browser/lib/services/storage-service';
import { IEventBus, localize, IReporterService, IReporterTimer, REPORT_NAME } from '@opensumi/ide-core-common';
import { SearchSettingId } from '@opensumi/ide-core-common/lib/settings/search';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  ICodeEditor,
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
  rootDirs: string[];
}

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

const resultTotalDefaultValue = Object.assign({}, { resultNum: 0, fileNum: 0 });

/**
 * ????????????????????????
 */
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
  private reporterService: IReporterService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

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

  searchDebounce: () => void;

  private searchOnType: boolean;

  constructor() {
    this.setDefaultIncludeValue();
    this.recoverUIState();

    this.searchOnType = this.searchPreferences[SearchSettingId.SearchOnType] || true;

    this.searchDebounce = debounce(
      () => {
        this.search();
      },
      this.searchPreferences[SearchSettingId.SearchOnTypeDebouncePeriod] || 300,
      {
        trailing: true,
      },
    );
  }

  searchOnTyping() {
    if (this.searchOnType) {
      this.searchDebounce();
    }
  }

  search = (e?: React.KeyboardEvent, insertUIState?: IUIState) => {
    if (e && e.keyCode !== Key.ENTER.keyCode) {
      return;
    }
    this.cleanOldSearch();
    const value = this.searchValue;
    if (!value) {
      return;
    }

    const state = insertUIState || this.UIState;

    this.doSearch(value, state);
  };

  doSearch(value: string, state: IUIState) {
    const searchOptions: ContentSearchOptions = {
      maxResults: 2000,
      matchCase: state.isMatchCase,
      matchWholeWord: state.isWholeWord,
      useRegExp: state.isUseRegexp,
      includeIgnored: state.isIncludeIgnored,

      include: splitOnComma(this.includeValue || ''),
      exclude: splitOnComma(this.excludeValue || ''),
    };

    searchOptions.exclude = this.getExcludeWithSetting(searchOptions, state);

    // ??????????????????
    this.searchHistory.setSearchHistory(value);

    this.isShowValidateMessage = true;

    this.isExpandAllResult = true;

    // Stop old search
    this.isSearchDoing = true;
    if (this.currentSearchId > -1) {
      this.contentSearchServer.cancel(this.currentSearchId);
      this.currentSearchId = this.currentSearchId + 1;
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

    // ????????????????????????????????????????????? workspace ???????????????
    searchOptions.encoding = this.preferenceService.get<string>(
      'files.encoding',
      undefined,
      rootDirSet.values().next()?.value,
    );

    // FIXME: ????????????????????????????????????????????? include ???????????????????????? workspaceFolders?????????????????????????????????????????????
    // ?????? searchId ?????????????????????????????????????????? search ???????????????????????? searchId ????????????
    // ????????????????????????????????? registerFileSearchProvider
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
    // ??? doc model ?????????
    const searchFromDocModelInfo = this.searchAllFromDocModel({
      searchValue: value,
      searchOptions,
      documentModelManager: this.documentModelManager,
      rootDirs,
    });

    // ??????????????????
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
  }

  // #region ???????????????????????????????????????????????? selection
  private EMPTY_SELECTION = new monaco.Range(0, 0, 0, 0);
  private lastEditor?: ICodeEditor;
  private lastSelection?: monaco.Range;
  setEditorSelections(editor: ICodeEditor, selections: monaco.Range) {
    // ??????????????? editor ??? selection
    this.lastEditor?.setSelection(this.EMPTY_SELECTION);

    this.lastEditor = editor;
    this.lastSelection = selections;
    this.applyEditorSelections();
  }
  /**
   * ?????? tabbar ??????????????????
   */
  applyEditorSelections() {
    if (this.lastEditor && this.lastSelection) {
      this.lastEditor.setSelection(this.lastSelection);
    }
  }
  /**
   * ?????? tabbar blur ??????????????????????????????
   * @param clearEditor ??????????????????????????? editor????????????????????????????????????
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
   * ????????????????????????????????????????????????
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

      // ?????????file????????????
      if (event.uri.scheme !== Schemes.file) {
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
        // ?????????????????????????????????
        if (resultData.result.length > 0) {
          this.resultTotal.fileNum++;
          this.resultTotal.resultNum = this.resultTotal.resultNum + resultData.result.length;
        }
      } else if (resultData.result.length < 1) {
        // ?????????????????????????????????????????????
        this.searchResults.delete(uriString);
        this.resultTotal.fileNum = this.resultTotal.fileNum - 1;
        this.resultTotal.resultNum = this.resultTotal.resultNum - oldResults.length;
        return;
      } else if (resultData.result.length !== oldResults!.length) {
        // ????????????????????????????????????
        this.resultTotal.resultNum = this.resultTotal.resultNum - oldResults!.length + resultData.result.length;
      }
      if (resultData.result.length > 0) {
        // ???????????????
        this.searchResults.set(uriString, resultData.result);
      }
      docModel.dispose();
    });
  }

  cleanOldSearch() {
    this.docModelSearchedList = [];
    this.searchResults.clear();
    this.resultTotal = resultTotalDefaultValue;
    this.clearEditorSelections(true);
  }

  /**
   * ?????????????????????????????????
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
      // ?????????????????????
      this.isSearchDoing = true;
      this.currentSearchId = id;
      this.cleanOldSearch();
    }

    if (this.currentSearchId && this.currentSearchId > id) {
      // ????????????????????????????????????????????????????????????????????????
      return;
    }

    if (searchState) {
      this.searchState = searchState;
      if (searchState === SEARCH_STATE.done || searchState === SEARCH_STATE.error) {
        // ??????????????????ID
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
      // ????????????
      this.isSearchDoing = false;
      this.searchError = error.toString();
      this.reporter = null;
    }

    transaction(() => {
      this.mergeSameUriResult(data, this.searchResults!, this.docModelSearchedList, this.resultTotal);
    });

    if (docModelSearchedList) {
      // ????????? docModel ???????????????????????????????????????????????????????????????
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
      this.applyEditorSelections();
    });
  }

  blur() {
    this.clearEditorSelections();
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
    this.searchOnTyping();
  };

  onReplaceInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.replaceValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
  };

  onSearchExcludeChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.excludeValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
    this.searchOnTyping();
  };

  onSearchIncludeChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.includeValue = e.currentTarget.value || '';
    this.titleStateEmitter.fire();
    this.searchOnTyping();
  };

  setSearchValueFromActivatedEditor = () => {
    const currentEditor = this.workbenchEditorService.currentEditor;
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

  get onTitleStateChange() {
    return this.titleStateEmitter.event;
  }

  private shouldSearch = (uiState: Partial<typeof this.UIState>) =>
    ['isWholeWord', 'isMatchCase', 'isUseRegexp', 'isIncludeIgnored', 'isOnlyOpenEditors'].some(
      (v) => uiState[v] !== undefined && uiState[v] !== this.UIState[v],
    );

  updateUIState = (obj: Partial<typeof this.UIState>, e?: React.KeyboardEvent) => {
    if (!isUndefined(obj.isSearchFocus) && obj.isSearchFocus !== this.UIState.isSearchFocus) {
      this.searchContextKey.searchInputFocused.set(obj.isSearchFocus);
      // ???????????????????????????????????????????????????????????????
      this.searchHistory.reset();
      this.isShowValidateMessage = false;
    }

    const newUIState = Object.assign({}, this.UIState, obj);

    if (this.shouldSearch(obj)) {
      this.search(e, newUIState);
    }

    this.UIState = newUIState;
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
    this.blur();
    this.titleStateEmitter.dispose();
    this.eventBusDisposer?.dispose();
  }

  private async recoverUIState() {
    const UIState = (await this.browserStorageService.getData('search.UIState')) as IUIState | undefined;
    // ?????????????????????????????????focus??????????????????????????????????????????UI???Service????????? (#1203)
    // ??????????????????????????????????????????updateUIState??????isSearchFocus??????false
    if (UIState) {
      UIState.isSearchFocus = false;
    }
    this.updateUIState(UIState || {});
  }

  private getExcludeWithSetting(searchOptions: ContentSearchOptions, state: IUIState) {
    let result: string[] = [];

    if (searchOptions.exclude) {
      result = result.concat(searchOptions.exclude);
    }

    // ?????????????????????
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
    // ?????? include ??????????????????????????????
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
        // ??????docModel??????????????????????????????
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

    if (searchOptions.include && searchOptions.include.length > 0) {
      // include ???????????????????????????????????????
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
      // exclude ????????????????????????????????????
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
        // ?????????????????????????????????
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

  private searchAllFromDocModel(options: SearchAllFromDocModelOptions): {
    result: ContentSearchResult[];
    searchedList: string[];
  } {
    const searchValue = options.searchValue;
    const searchOptions = options.searchOptions;
    const documentModelManager = options.documentModelManager;
    const rootDirs = options.rootDirs;

    let result: ContentSearchResult[] = [];
    let searchedList: string[] = [];
    const docModels = documentModelManager.getAllModels();
    const group = this.workbenchEditorService.currentEditorGroup;

    const filterFileWithGlobRelativePath = new FilterFileWithGlobRelativePath(rootDirs, searchOptions.include || []);

    docModels.forEach((docModel: IEditorDocumentModel) => {
      const uriString = docModel.uri.toString();

      // ?????????file????????????
      if (docModel.uri.scheme !== Schemes.file) {
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
