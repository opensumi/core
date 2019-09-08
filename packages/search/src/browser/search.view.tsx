import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext, localize, URI, Schemas } from '@ali/ide-core-browser';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { ViewState } from '@ali/ide-activity-panel';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IWorkspaceService } from '@ali/ide-workspace';
import * as cls from 'classnames';
import * as styles from './search.module.less';
import {
  IContentSearchServer,
  ContentSearchServerPath,
  ContentSearchOptions,
  SEARCH_STATE,
  ResultTotal,
} from '../common/';
import { SearchBrowserService } from './search.service';
import { SearchTree } from './search-tree.view';
import { replaceAll } from './replace';
import { useSearchResult, searchFromDocModel } from './use-search-result';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';

let currentSearchID: number | null = null;

interface IUIState {
  isSearchFocus: boolean;
  isToggleOpen: boolean;
  isDetailOpen: boolean;
  isMatchCase: boolean;
  isWholeWord: boolean;
  isUseRegexp: boolean;
  isIncludeIgnored: boolean;
}

type CallbackFunction = (...args: any[]) => void;

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

function getResultTotalContent(total: ResultTotal) {
  if (total.resultNum > 0) {
    return (
      <p className={styles.result_describe}>
        {
          localize('search.files.result', '{0} result in {1} files')
            .replace('{0}', String(total.resultNum))
            .replace('{1}', String(total.fileNum))
        }
      </p>
    );
  }
  return '';
}

export const Search = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>,
) => {
  const searchOptionRef = React.createRef<HTMLDivElement>();
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const searchInWorkspaceServer: IContentSearchServer = injector.get(ContentSearchServerPath);
  const searchBrowserService = injector.get(SearchBrowserService);
  const documentModelManager = injector.get(IEditorDocumentModelService);
  const dialogService: IDialogService = injector.get(IDialogService);
  const messageService: IMessageService = injector.get(IMessageService);
  const workbenchEditorService: WorkbenchEditorService = injector.get(WorkbenchEditorService);
  const workspaceService: IWorkspaceService = injector.get(IWorkspaceService);
  const {
    searchResults,
    setSearchResults,
    searchState,
    setSearchState,
    resultTotal,
    setResultTotal,
  } = useSearchResult(searchBrowserService);
  const replaceInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  let includeInputEl: HTMLInputElement | null;
  let excludeInputEl: HTMLInputElement | null;

  const [UIState, setUIState] = React.useState({
    isSearchFocus: false,
    isToggleOpen: false,
    isDetailOpen: false,

    // Search Options
    isMatchCase: false,
    isWholeWord: false,
    isUseRegexp: false,
    isIncludeIgnored: false,
  } as IUIState);

  const [searchValue, setSearchValue] = React.useState('');
  const [searchPanelLayout, setSearchPanelLayout] = React.useState({height: 0, width: 0});
  const searchTreeRef = React.useRef();

  let isReplaceDoing = false;

  searchBrowserService.setSearchInfo({
    searchResults,
    searchState,
    searchValue,
  });

  function updateUIState(obj, e?: React.KeyboardEvent | React.MouseEvent) {
    const newUIState = Object.assign({}, UIState, obj);
    setUIState(newUIState);
    if (!e) { return; }
    search(e, newUIState);
  }

  function doReplaceAll() {
    if (isReplaceDoing) {
      return;
    }
    isReplaceDoing = true;
    replaceAll(
      documentModelManager,
      searchResults!,
      (replaceInputRef.current && replaceInputRef.current.value)  || '',
      dialogService,
      messageService,
      resultTotal,
    ).then((isDone) => {
      isReplaceDoing = false;
      if (!isDone) {
        return;
      }
      search();
    });
  }

  const search =  (e?: React.KeyboardEvent | React.MouseEvent, insertUIState?: IUIState) => {
    const state = insertUIState || UIState;
    const value = searchValue;
    const searchOptions: ContentSearchOptions = {
      maxResults: 2000,
      matchCase: state.isMatchCase,
      matchWholeWord: state.isWholeWord,
      useRegExp: state.isUseRegexp,
      includeIgnored: state.isIncludeIgnored,

      include: splitOnComma(includeInputEl && includeInputEl.value || ''),
      exclude: splitOnComma(excludeInputEl && excludeInputEl.value || ''),
    };

    if (e && (e as any).keyCode !== undefined && Key.ENTER.keyCode !== (e as any).keyCode) {
      return;
    }
    if (!value) {
      return clear();
    }
    // Stop old search
    if (currentSearchID) {
      searchInWorkspaceServer.cancel(currentSearchID);
    }
    let rootDirs: string[] = [];
    workspaceService.tryGetRoots().forEach((stat) => {
      const uri = new URI(stat.uri);
      if (uri.scheme !== Schemas.file) {
        return;
      }
      return rootDirs.push(uri.codeUri.fsPath);
    });
    if (rootDirs.length < 1) {
      rootDirs = [workspaceDir];
    }
    // Get result from doc model
    const searchFromDocModelInfo = searchFromDocModel(
      value,
      searchOptions,
      documentModelManager,
      workbenchEditorService,
      rootDirs,
    );
    // Get result from search service
    searchInWorkspaceServer.search(value, rootDirs , searchOptions).then((id) => {
      currentSearchID = id;
      searchBrowserService.onSearchResult({
        id,
        data: searchFromDocModelInfo.result,
        searchState: SEARCH_STATE.doing,
        docModelSearchedList: searchFromDocModelInfo.searchedList,
      });
    });
  };

  function onSearchInputChange(e: React.FormEvent<HTMLInputElement>) {
    setSearchValue((e.currentTarget.value || '').trim());
  }

  function clear() {
    setSearchValue('');
    setSearchResults(null);
    setResultTotal({fileNum: 0, resultNum: 0});
    setSearchState(SEARCH_STATE.todo);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
    }
    if (includeInputEl) {
      includeInputEl.value = '';
    }
    if (excludeInputEl) {
      excludeInputEl.value = '';
    }
  }

  searchBrowserService.onFocus(() => {
    if (!searchInputRef.current) {
      return;
    }
    searchInputRef.current.focus();
  });

  searchBrowserService.onClean(() => {
    clear();
  });

  searchBrowserService.onRefresh(() => {
    if (searchState === SEARCH_STATE.doing) {
      return;
    }
    if (currentSearchID) {
      searchInWorkspaceServer.cancel(currentSearchID);
    }
    search();
  });

  searchBrowserService.onFold(() => {
    if (searchTreeRef && searchTreeRef.current) {
      (searchTreeRef as any).current.foldTree();
    }
  });

  React.useEffect(() => {
    setSearchPanelLayout({
      width: searchOptionRef.current && searchOptionRef.current.clientWidth || 0,
      height: searchOptionRef.current && searchOptionRef.current.clientHeight || 0,
    });
  }, [UIState]);

  const collapsePanelContainerStyle = {
    width: viewState.width,
    height: viewState.height,
  };

  return (
    <div className={styles.wrap} style={collapsePanelContainerStyle}>
      <div className={styles.search_options} ref={searchOptionRef}>
        <div className={styles.search_and_replace_container}>
          <div
            title={localize('search.replace.toggle.button.title')}
            className={cls(styles['replace-toggle'], { [styles['toggle-open']]: UIState.isToggleOpen })}
            onClick={() => updateUIState({ isToggleOpen: !UIState.isToggleOpen })}
          >
            <span className={cls('fa', { ['fa-caret-down']: UIState.isToggleOpen, ['fa-caret-right']: !UIState.isToggleOpen })}></span>
          </div>
          <div className={styles.search_and_replace_fields}>
            <div className={styles.search_field_container}>
              <div className={cls(styles.search_field, { [styles.focus]: UIState.isSearchFocus })}>
                <input
                  id='search-input-field'
                  title={localize('searchView')}
                  autoFocus
                  type='text'
                  placeholder={localize('searchView')}
                  onFocus={() => updateUIState({ isSearchFocus: true })}
                  onKeyUp={search}
                  onChange={onSearchInputChange}
                  ref={searchInputRef}
                />
                <div className={styles.option_buttons}>
                  <span
                    className={cls('volans_icon ab', styles['match-case'], styles.option, { [styles.select]: UIState.isMatchCase })}
                    title={localize('caseDescription')}
                    onClick={(e) => updateUIState({ isMatchCase: !UIState.isMatchCase }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon abl', styles['whole-word'], styles.option, { [styles.select]: UIState.isWholeWord })}
                    title={localize('wordsDescription')}
                    onClick={(e) => updateUIState({ isWholeWord: !UIState.isWholeWord }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon holomorphy', styles['use-regexp'], styles.option, { [styles.select]: UIState.isUseRegexp })}
                    title={localize('regexDescription')}
                    onClick={(e) => updateUIState({ isUseRegexp: !UIState.isUseRegexp }, e)}
                  ></span>
                  <span
                    className={cls('fa fa-eye', styles['include-ignored'], styles.option, { [styles.select]: UIState.isIncludeIgnored })}
                    title={localize('includeIgnoredFiles')}
                    onClick={(e) => updateUIState({ isIncludeIgnored: !UIState.isIncludeIgnored }, e)}
                  ></span>
                </div>
              </div>
              {/* <div className='search-notification '>
              <div>This is only a subset of all results. Use a more specific search term to narrow down the result list.</div>
            </div> */}
            </div>
            {UIState.isToggleOpen ? <div className={styles.replace_field}>
              <input
                id='replace-input-field'
                title={localize('match.replace.label')}
                type='text'
                placeholder={localize('match.replace.label')}
                onKeyUp={search}
                ref={replaceInputRef}
              />
              <span
                className={cls('volans_icon swap', styles.replace)}
                title={localize('match.replace.label')}
                onClick={doReplaceAll}
              ></span>
              <div className={styles['replace-all-button_container']}>
                <span title={localize('replaceAll.confirmation.title')} className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
              </div>
            </div> : ''
            }
          </div>
        </div>

        <div className={cls(styles.search_details)}>
          <div
            className={cls(styles.button_container)}
            onClick={() => updateUIState({ isDetailOpen: !UIState.isDetailOpen })}
          >
            <span className='fa fa-ellipsis-h'></span>
          </div>
          {UIState.isDetailOpen ?
            <div className='glob_field-container'>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}> {localize('searchScope.includes')}</div>
                <input
                  type='text'
                  onKeyUp={search}
                  ref={(el) => includeInputEl = el}
                />
              </div>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}>{localize('searchScope.excludes')}</div>
                <input
                  type='text'
                  onKeyUp={search}
                  ref={(el) => excludeInputEl = el}
                />
              </div>
            </div> : ''
          }
        </div>

      </div>
      {getResultTotalContent(resultTotal)}
      {console.log('searchResults', searchResults)}
      {
        (searchResults && searchResults.size > 0) ? <SearchTree
          searchPanelLayout = {searchPanelLayout}
          searchResults={searchResults}
          searchValue={searchValue}
          searchState={searchState}
          ref={searchTreeRef}
          replaceInputRef={replaceInputRef}
          viewState={viewState}
        /> : <div className={styles.result_describe}>
          {
            searchState === SEARCH_STATE.done ?
            localize('noResultsFound').replace('-', '')
            : ''
          }
        </div>
      }
    </div >
  );
});
