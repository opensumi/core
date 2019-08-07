import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext, localize } from '@ali/ide-core-browser';
import { IDocumentModelManager, IDocumentModel } from '@ali/ide-doc-model/lib/common';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
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

let currentSearchID: number | null = null;

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

function getSearchMenuContent(options: {
  searchValue: string,
  clear: any,
  searchState: SEARCH_STATE,
  searchInWorkspaceServer: IContentSearchServer,
  searchTreeRef: any,
}) {
  const {
    searchValue,
    clear,
    searchState,
    searchInWorkspaceServer,
    searchTreeRef,
  } = options;
  const list = [
    {
      icon: 'fold',
      title: localize('CollapseDeepestExpandedLevelAction.label', 'fold'),
      onClick: () => {
        searchTreeRef.current.foldTree();
      },
      getClassName: () => {
        return searchValue ? styles.menu_active : '';
      },
    }, {
      icon: 'search_close',
      title: localize('ClearSearchResultsAction.label', 'clear'),
      getClassName: (): string => {
        return searchValue ? styles.menu_active : '';
      },
      onClick: () => {
        clear();
      },
    },
    {
      icon: '',
      title: localize('RefreshAction.label', 'refresh'),
      onClick: () => {
        if (searchState !== SEARCH_STATE.doing) {
          return;
        }
        if (currentSearchID) {
          searchInWorkspaceServer.cancel(currentSearchID);
        }
      },
      getClassName: () => {
        if (searchState === SEARCH_STATE.doing) {
          return 'compile_stop ' + styles.menu_active;
        }
        return 'refresh';
      },
    },
  ];

  return (
    list.map((button) => {
       return <span
        key={button.icon}
        className={cls('volans_icon', styles.menu, button.icon, button.getClassName())}
        title={button.title}
        onClick={button.onClick}
      ></span>;
    })
  );
}

function getResultTotalContent(total: ResultTotal) {
  if (total.resultNum > 0) {
    return (
      <p className={styles.result_describe}>{total.resultNum} results in {total.fileNum} files</p>
    );
  }
  return '';
}

export const Search = observer(() => {
  const searchOptionRef = React.createRef<HTMLDivElement>();
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const searchInWorkspaceServer: IContentSearchServer = injector.get(ContentSearchServerPath);
  const searchBrowserService = injector.get(SearchBrowserService);
  const documentModelManager = injector.get(IDocumentModelManager);
  const dialogService = injector.get(IDialogService);
  const messageService = injector.get(IMessageService);
  const {
    searchResults,
    setSearchResults,
    searchState,
    setSearchState,
    resultTotal,
    setResultTotal,
  } = useSearchResult(searchBrowserService);
  let searchInputEl: HTMLInputElement | null;
  let replaceInputEl: HTMLInputElement | null;
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
  });

  const [searchValue, setSearchValue] = React.useState('');
  const [searchPanelLayout, setSearchPanelLayout] = React.useState({height: 0, width: 0});
  const searchTreeRef = React.useRef();

  let isReplaceDoing = false;

  function updateUIState(obj, e?: React.KeyboardEvent | React.MouseEvent) {
    setUIState(Object.assign({}, UIState, obj));
    if (!e) { return; }
    search(e);
  }

  function doReplaceAll() {
    if (isReplaceDoing) {
      return;
    }
    isReplaceDoing = true;
    replaceAll(
      messageService,
      dialogService,
      documentModelManager,
      searchResults!,
      replaceInputEl && replaceInputEl.value || '',
      resultTotal,
    ).then((isDone) => {
      if (!isDone) {
        return;
      }
      isReplaceDoing = false;
      search();
    });
  }

  const search =  (e?: React.KeyboardEvent | React.MouseEvent) => {
    const value = searchValue;
    const searchOptions: ContentSearchOptions = {
      maxResults: 1000,
      matchCase: UIState.isMatchCase,
      matchWholeWord: UIState.isWholeWord,
      useRegExp: UIState.isUseRegexp,
      includeIgnored: UIState.isIncludeIgnored,

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
    // Get result from doc model
    const searchFromDocModelInfo = searchFromDocModel(value, searchOptions, documentModelManager);
    // Get result from search service
    searchInWorkspaceServer.search(value, [workspaceDir], searchOptions).then((id) => {
      currentSearchID = id;
      searchBrowserService.onSearchResult({
        id,
        data: searchFromDocModelInfo.result,
        searchState: SEARCH_STATE.willDoing,
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
    if (searchInputEl) {
      searchInputEl.value = '';
    }
    if (replaceInputEl) {
      replaceInputEl.value = '';
    }
    if (includeInputEl) {
      includeInputEl.value = '';
    }
    if (excludeInputEl) {
      excludeInputEl.value = '';
    }
  }

  React.useEffect(() => {
    setSearchPanelLayout({
      width: searchOptionRef.current && searchOptionRef.current.clientWidth || 0,
      height: searchOptionRef.current && searchOptionRef.current.clientHeight || 0,
    });
  }, [searchOptionRef]);

  return (
    <div className={styles.wrap}>
      <div className={styles.search_options} ref={searchOptionRef}>
        <div className={styles.header}>
          <span>{localize('searchView')}</span>
          {getSearchMenuContent({
            searchValue,
            clear,
            searchState,
            searchInWorkspaceServer,
            searchTreeRef,
          })}
        </div>
        <div className={styles.search_and_replace_container}>
          <div
            title={localize('search.replace.toggle.button.title', 'Toggle Replace')}
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
                  title={localize('searchView', 'Search')}
                  type='text'
                  placeholder={localize('searchView', 'Search')}
                  onFocus={() => updateUIState({ isSearchFocus: true })}
                  onKeyUp={search}
                  onChange={onSearchInputChange}
                  ref={(el) => searchInputEl = el}
                />
                <div className={styles.option_buttons}>
                  <span
                    className={cls('volans_icon ab', styles['match-case'], styles.option, { [styles.select]: UIState.isMatchCase })}
                    title={localize('workbench.action.terminal.toggleFindCaseSensitive', 'match case')}
                    onClick={(e) => updateUIState({ isMatchCase: !UIState.isMatchCase }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon abl', styles['whole-word'], styles.option, { [styles.select]: UIState.isWholeWord })}
                    title={localize('workbench.action.terminal.toggleFindWholeWord', 'Match Whole Word')}
                    onClick={(e) => updateUIState({ isWholeWord: !UIState.isWholeWord }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon holomorphy', styles['use-regexp'], styles.option, { [styles.select]: UIState.isUseRegexp })}
                    title={localize('workbench.action.terminal.toggleFindRegex', 'Use Regular Expression')}
                    onClick={(e) => updateUIState({ isUseRegexp: !UIState.isUseRegexp }, e)}
                  ></span>
                  <span
                    className={cls('fa fa-eye', styles['include-ignored'], styles.option, { [styles.select]: UIState.isIncludeIgnored })}
                    title='Include Ignored Files'
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
                title={localize('match.replace.label', 'Replace')}
                type='text'
                placeholder={localize('match.replace.label', 'Replace')}
                onKeyUp={search}
                ref={(el) => replaceInputEl = el}
              />
              <span
                className={cls('volans_icon swap', styles.replace)}
                title={localize('match.replace.label', 'Replace')}
                onClick={doReplaceAll}
              ></span>
              <div className={styles['replace-all-button_container']}>
                <span title={localize('replaceAll.confirmation.title', 'Replace all')} className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
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
                <div className={cls(styles.label)}> {localize('searchScope.includes', 'files to include')}</div>
                <input
                  type='text'
                  ref={(el) => includeInputEl = el}
                />
              </div>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}>{localize('label.excludes')}</div>
                <input
                  type='text'
                  ref={(el) => excludeInputEl = el}
                />
              </div>
            </div> : ''
          }
        </div>

      </div>
      {getResultTotalContent(resultTotal)}
      {
        (searchResults && searchResults.size > 0) ? <SearchTree
          searchPanelLayout = {searchPanelLayout}
          searchResults={searchResults}
          searchValue={searchValue}
          searchState={searchState}
          ref={searchTreeRef}
        /> : <div className={styles.result_describe}>
          {
            searchState === SEARCH_STATE.done ?
            localize('noResultsFound', 'No results found.').replace('-', '')
            : ''
          }
        </div>
      }
    </div >
  );
});
