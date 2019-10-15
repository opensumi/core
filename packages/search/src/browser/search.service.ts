/**
 * 用于文件内容搜索
 */
import * as React from 'react';
import { createRef } from 'react';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { Emitter, IEventBus, trim, isUndefined } from '@ali/ide-core-common';
import { parse, ParsedPattern } from '@ali/ide-core-common/lib/utils/glob';
import {
  Key,
  URI,
  Schemas,
  IDisposable,
  CommandService,
  COMMON_COMMANDS,
} from '@ali/ide-core-browser';
import {
  LocalStorageService,
} from '@ali/ide-core-browser/lib/services/storage-service';
import { IWorkspaceService } from '@ali/ide-workspace';
import {
  IEditorDocumentModelService,
  IEditorDocumentModel,
  EditorDocumentModelContentChangedEvent,
  IEditorDocumentModelContentChangedEventPayload,
} from '@ali/ide-editor/lib/browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { observable, transaction, action } from 'mobx';
import {
  ContentSearchResult,
  SEARCH_STATE,
  ContentSearchOptions,
  IContentSearchServer,
  ContentSearchServerPath,
  ResultTotal,
  SendClientResult,
  getRoot,
  anchorGlob,
  IContentSearchClientService,
  IUIState,
} from '../common';
import { SearchPreferences } from './search-preferences';
import { SearchHistory } from './search-history';

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

const resultTotalDefaultValue = Object.assign({}, { resultNum: 0, fileNum: 0});

@Injectable()
export class ContentSearchClientService implements IContentSearchClientService {
  protected titleStateEmitter: Emitter<void> = new Emitter();
  protected eventBusDisposer: IDisposable;

  @Autowired(IEventBus)
  eventBus: IEventBus;
  @Autowired(SearchPreferences)
  searchPreferences: SearchPreferences;
  @Autowired(CorePreferences)
  corePreferences: CorePreferences;
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;
  @Autowired(ContentSearchServerPath)
  contentSearchServer: IContentSearchServer;
  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;
  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;
  @Autowired(CommandService)
  private commandService: CommandService;
  @Autowired(LocalStorageService)
  private readonly storageService: LocalStorageService;

  workbenchEditorService: WorkbenchEditorService;

  @observable
  replaceValue: string = '';
  @observable
  searchValue: string = '';
  @observable
  searchError: string = '';
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

    // Replace state
    isReplaceDoing: false,
  };
  @observable
  searchResults: Map<string, ContentSearchResult[]> = observable.map();
  @observable
  resultTotal: ResultTotal = resultTotalDefaultValue;
  searchHistory: SearchHistory;

  docModelSearchedList: string[] = [];
  currentSearchId: number = -1;

  searchInputEl = createRef<HTMLInputElement>();
  replaceInputEl = createRef<HTMLInputElement>();
  includeInputEl = createRef<HTMLInputElement>();
  excludeInputEl = createRef<HTMLInputElement>();

  constructor() {
    setTimeout(() => {
      // TODO 不在为什么会有循环依赖问题
      this.searchHistory = new SearchHistory(this, this.workspaceService);
    });
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

      include: splitOnComma(this.includeInputEl && this.includeInputEl.current && this.includeInputEl.current.value || ''),
      exclude: splitOnComma(this.excludeInputEl && this.excludeInputEl.current && this.excludeInputEl.current.value || ''),
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

    // Stop old search
    if (this.currentSearchId) {
      this.contentSearchServer.cancel(this.currentSearchId);
      this.cleanOldSearch();
    }
    const rootDirs: string[] = [];
    this.workspaceService.tryGetRoots().forEach((stat) => {
      const uri = new URI(stat.uri);
      if (uri.scheme !== Schemas.file) {
        return;
      }
      return rootDirs.push(uri.toString());
    });
    // 从 doc model 中搜索
    const searchFromDocModelInfo = this.searchAllFromDocModel({
      searchValue: value,
      searchOptions,
      documentModelManager: this.documentModelManager,
      workbenchEditorService: this.workbenchEditorService,
      rootDirs,
    });

    // 从服务端搜索
    this.contentSearchServer.search(value, rootDirs , searchOptions).then((id) => {
      this.currentSearchId = id;
      this.onSearchResult({
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

      if (!this.searchResults) {
        return;
      }

      const uriString = event.uri.toString();

      const docModel = this.documentModelManager.getModelReference(event.uri);
      if (!docModel) {
        return;
      }
      const resultData = this.searchFromDocModel(
        searchOptions,
        docModel.instance,
        this.searchValue,
        rootDirs,
      );

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
    const { id, data, searchState, error, docModelSearchedList } = sendClientResult;
    if (!data) {
      return;
    }

    if (id > this.currentSearchId) {
      // 新的搜索开始了
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
        this.currentSearchId = -1;
      }
    }

    if (error) {
      // 搜索出错
      this.searchError = error.toString();
    }

    transaction(() => {
      this.mergeSameUriResult(
        data,
        this.searchResults!,
        this.docModelSearchedList,
        this.resultTotal,
      );
    });

    if (docModelSearchedList) {
      // 记录通 docModel 搜索过的文件，用于过滤服务端搜索的重复内容
      this.docModelSearchedList = docModelSearchedList;
    }
    this.titleStateEmitter.fire();
  }

  focus() {
    if (!this.searchInputEl || !this.searchInputEl.current) {
      return;
    }
    this.searchInputEl.current.focus();
    if (this.searchValue !== '') {
      this.searchInputEl.current.select();
    }
  }

  refresh() {
    this.search();
  }

  refreshIsEnable() {
    return !!((this.searchState !== SEARCH_STATE.doing) && this.searchValue);
  }

  clean() {
    this.searchValue = '';
    this.searchResults.clear();
    this.resultTotal = {fileNum: 0, resultNum: 0};
    this.searchState = SEARCH_STATE.todo;
    this.searchValue = '';
    // if (this.searchInputEl) {
    //   this.searchInputEl.current.value = '';
    // }
    this.replaceValue = '';
    // if (this.replaceInputEl) {
    //   this.replaceInputEl.value = '';
    // }
    if (this.includeInputEl && this.includeInputEl.current) {
      this.includeInputEl.current.value = '';
    }
    if (this.excludeInputEl && this.excludeInputEl.current) {
      this.excludeInputEl.current.value = '';
    }
    this.titleStateEmitter.fire();
  }

  cleanIsEnable() {
    return !!(
      this.searchValue ||
      this.replaceValue ||
      (this.excludeInputEl && this.excludeInputEl.current && this.excludeInputEl.current.value) ||
      (this.includeInputEl && this.includeInputEl.current && this.includeInputEl.current.value) ||
      (this.searchResults && this.searchResults.size > 0));
  }

  foldIsEnable() {
    return !!(this.searchResults && this.searchResults.size > 0);
  }

  onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.searchValue = (e.currentTarget.value || '').trim();
    this.titleStateEmitter.fire();
  }

  onReplaceInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.replaceValue = (e.currentTarget.value || '').trim();
    this.titleStateEmitter.fire();
  }

  setSearchValueFromActivatedEditor = () => {
    if (!this.workbenchEditorService) {
      this.workbenchEditorService = this.injector.get(WorkbenchEditorService);
    }

    const currentEditor = this.workbenchEditorService.currentEditor;
    if (currentEditor) {
      const selections = currentEditor.getSelections();
      if (selections && selections.length > 0 && currentEditor.currentDocumentModel) {
        const {
          selectionStartLineNumber,
          selectionStartColumn,
          positionLineNumber,
          positionColumn,
        } = selections[0];
        const selectionText = currentEditor.currentDocumentModel.getText(
          new monaco.Range(
            selectionStartLineNumber,
            selectionStartColumn,
            positionLineNumber,
            positionColumn,
          ),
        );

        const searchText = trim(selectionText) === '' ? this.searchValue : selectionText;
        this.searchValue = searchText;
      }
    }
  }

  get onTitleStateChange() {
    return this.titleStateEmitter.event;
  }

  updateUIState = (obj, e?: React.KeyboardEvent | React.MouseEvent) => {
    if (!isUndefined(obj.isSearchFocus) && (obj.isSearchFocus !== this.UIState.isSearchFocus)) {
      // 搜索框状态发现变化，重置搜索历史的当前位置
      this.searchHistory.reset();
    }
    const newUIState = Object.assign({}, this.UIState, obj);
    this.UIState = newUIState;
    this.storageService.setData('search.UIState', newUIState);
    if (!e) { return; }
    this.search(e, newUIState);
  }

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
    this.commandService.executeCommand(COMMON_COMMANDS.OPEN_PREFERENCES.id);
  }

  dispose() {
    this.titleStateEmitter.dispose();
  }

  private async recoverUIState() {
    const UIState = (await this.storageService.getData('search.UIState')) as IUIState;
    this.updateUIState(UIState);
  }

  private getExcludeWithSetting(searchOptions: ContentSearchOptions) {
    let result: string[] = [];

    if (searchOptions.exclude) {
      result = result.concat(searchOptions.exclude);
    }

    result = result.concat(this.getPreferenceSearchExcludes());

    return result;
  }

  private mergeSameUriResult(
    data: ContentSearchResult[],
    searchResultMap: Map<string, ContentSearchResult[]>,
    docSearchedList: string[],
    total?: ResultTotal,
  ) {
    const theTotal = total || { fileNum: 0, resultNum: 0};
    data.forEach((result: ContentSearchResult) => {
      const oldData: ContentSearchResult[] | undefined = searchResultMap.get(result.fileUri);
      if (docSearchedList.indexOf(result.fileUri) > -1) {
        // 通过docModel搜索过的文件不再搜索
        return;
      }
      if (oldData) {
        oldData.push(result);
        searchResultMap.set(result.fileUri, oldData);
        theTotal.resultNum ++;
      } else {
        searchResultMap.set(result.fileUri, [result]);
        theTotal.fileNum ++;
        theTotal.resultNum ++;
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
    result: ContentSearchResult[],
    searchedList: string[],
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
      const isInclude = matcherList.some((matcher) => {
        return matcher(uriString);
      });
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

      const isExclude = matcherList.some((matcher) => {
        return matcher(uriString);
      });
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
    const findResults = textModel.findMatches(searchValue,
      true,
      !!searchOptions.useRegExp,
      !!searchOptions.matchCase,
      !!searchOptions.matchWholeWord ? ' \n' : null,
      false,
    );
    findResults.forEach((find: monaco.editor.FindMatch, index) => {
      if (index === 0 && codeEditor) {
        // 给打开文件添加选中状态
        codeEditor.setSelection(find.range);
      }
      result.push({
        root: getRoot(rootDirs, docModel.uri.codeUri.fsPath),
        fileUri: docModel.uri.toString(),
        line: find.range.startLineNumber,
        matchStart: find.range.startColumn,
        matchLength: find.range.endColumn - find.range.startColumn,
        lineText: textModel.getLineContent(find.range.startLineNumber),
      });
    });

    return {
      result,
      searchedList,
    };
  }

  private searchAllFromDocModel(options: SearchAllFromDocModelOptions): {
    result: ContentSearchResult[],
    searchedList: string[],
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

    docModels.forEach((docModel: IEditorDocumentModel) => {
      const uriString = docModel.uri.toString();

      // 非激活态的忽略
      if (!resources.some((res) => {
        return res.uri.toString() === uriString;
      })) {
        return;
      }

      const data = this.searchFromDocModel(
        searchOptions,
        docModel,
        searchValue,
        rootDirs,
        group.codeEditor,
      );

      result = result.concat(data.result);
      searchedList = searchedList.concat(data.searchedList);
    });

    return {
      result,
      searchedList,
    };
  }

}
