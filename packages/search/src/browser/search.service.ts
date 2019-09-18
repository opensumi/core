/**
 * 用于文件内容搜索
 */
import * as React from 'react';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { Emitter, IEventBus, trim } from '@ali/ide-core-common';
import { parse, ParsedPattern } from '@ali/ide-core-common/lib/utils/glob';
import {
  Key,
  URI,
  Schemas,
  IDisposable,
} from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import {
  IEditorDocumentModelService,
  IEditorDocumentModel,
  EditorDocumentModelContentChangedEvent,
  IEditorDocumentModelContentChangedEventPayload,
} from '@ali/ide-editor/lib/browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { observable, transaction } from 'mobx';
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
} from '../common';
import { SearchPreferences } from './search-preferences';

interface IUIState {
  isSearchFocus: boolean;
  isToggleOpen: boolean;
  isDetailOpen: boolean;
  isMatchCase: boolean;
  isWholeWord: boolean;
  isUseRegexp: boolean;
  isIncludeIgnored: boolean;
}

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
export class SearchBrowserService {

  protected foldEmitterDisposer;
  protected foldEmitter: Emitter<void> = new Emitter();
  protected titleStateEmitter: Emitter<void> = new Emitter();

  protected eventBusDisposer: IDisposable;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(SearchPreferences)
  searchPreferences: SearchPreferences;

  @Autowired(CorePreferences)
  corePreferences: CorePreferences;

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
    isToggleOpen: false,
    isDetailOpen: false,

    // Search Options
    isMatchCase: false,
    isWholeWord: false,
    isUseRegexp: false,
    isIncludeIgnored: false,
  };
  @observable
  searchResults: Map<string, ContentSearchResult[]> = observable.map();
  @observable
  resultTotal: ResultTotal = resultTotalDefaultValue;

  docModelSearchedList: string[] = [];
  currentSearchId: number = -1;

  replaceInputEl: HTMLInputElement | null;
  searchInputEl: HTMLInputElement | null;
  includeInputEl: HTMLInputElement | null;
  excludeInputEl: HTMLInputElement | null;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(ContentSearchServerPath)
  contentSearchServer: IContentSearchServer;
  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;
  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;

  workbenchEditorService: WorkbenchEditorService;

  search = (e?: React.KeyboardEvent | React.MouseEvent, insertUIState?: IUIState) => {
    const state = insertUIState || this.UIState;
    const value = this.searchValue;
    const searchOptions: ContentSearchOptions = {
      maxResults: 2000,
      matchCase: state.isMatchCase,
      matchWholeWord: state.isWholeWord,
      useRegExp: state.isUseRegexp,
      includeIgnored: state.isIncludeIgnored,

      include: splitOnComma(this.includeInputEl && this.includeInputEl.value || ''),
      exclude: splitOnComma(this.excludeInputEl && this.excludeInputEl.value || ''),
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

    this.watchDocModelContentChange(searchOptions, rootDirs);
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
        this.resultTotal.fileNum++;
        this.resultTotal.resultNum = this.resultTotal.fileNum + resultData.result.length;
      } else if (resultData.result.length < 1) {
        this.searchResults.delete(uriString);
        this.resultTotal.fileNum = this.resultTotal.fileNum - 1;
        return;
      } else if (resultData.result.length !== oldResults!.length) {
        this.resultTotal.resultNum = this.resultTotal.resultNum - oldResults!.length + resultData.result.length;
      }
      const oldMap = new Map(this.searchResults);
      oldMap.set(uriString, resultData.result);
      this.searchResults.clear();
      this.searchResults = observable.map(oldMap);
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
    if (!this.searchInputEl) {
      return;
    }
    this.searchInputEl.focus();
    if (this.searchValue !== '') {
      this.searchInputEl.select();
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
    if (this.searchInputEl) {
      this.searchInputEl.value = '';
    }
    if (this.replaceInputEl) {
      this.replaceInputEl.value = '';
    }
    if (this.includeInputEl) {
      this.includeInputEl.value = '';
    }
    if (this.excludeInputEl) {
      this.excludeInputEl.value = '';
    }
    this.titleStateEmitter.fire();
  }

  cleanIsEnable() {
    return !!(this.searchValue || (this.searchResults && this.searchResults.size > 0));
  }

  fold() {
    this.foldEmitter.fire();
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

  get onFold() {
    return (callback) => {
      if (this.foldEmitterDisposer && this.foldEmitterDisposer.dispose) {
        this.foldEmitterDisposer.dispose();
      }
      this.foldEmitterDisposer = this.foldEmitter.event(callback);
    };
  }

  dispose() {
    this.foldEmitter.dispose();
    this.titleStateEmitter.dispose();
  }

  private getExcludeWithSetting(searchOptions: ContentSearchOptions) {
    let result: string[] = [];

    if (searchOptions.exclude) {
      result = result.concat(searchOptions.exclude);
    }

    result = result.concat(this.getPreferenceSearchExcludes());

    return result;
  }

  private getPreferenceSearchExcludes(): string[] {
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
    const matcherList: ParsedPattern[] = [];
    const uriString = docModel.uri.toString();
    const result: ContentSearchResult[] = [];
    const searchedList: string[] = [];

    if (searchOptions.include) {
      searchOptions.include.forEach((str: string) => {
        matcherList.push(parse(anchorGlob(str)));
      });
    }
    if (searchOptions.exclude) {
      searchOptions.exclude.forEach((str: string) => {
        matcherList.push(parse('!' + anchorGlob(str)));
      });
    }

    // include 、exclude 过滤
    if (matcherList.length > 0 && !matcherList.some((matcher) => {
      return matcher(uriString);
    })) {
      return {
        result,
        searchedList,
      };
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
