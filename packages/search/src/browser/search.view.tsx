import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext } from '@ali/ide-core-browser';
import { IDocumentModelManager, IDocumentModel } from '@ali/ide-doc-model/lib/common';
import * as cls from 'classnames';
import * as styles from './search.module.less';
import {
  IContentSearchServer,
  ContentSearchServerPath,
  ContentSearchOptions,
  ContentSearchResult,
  SEARCH_STATE,
  SendClientResult,
} from '../common/';
import { SearchBrowserService } from './search.service';
import { SearchTree } from './search-tree.view';

interface ResultTotal {
  fileNum: number;
  resultNum: number;
}

let currentSearchID: number | null = null;

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

function searchFromDocModel(
  searchValue: string,
  searchOptions: ContentSearchOptions,
  documentModelManager: IDocumentModelManager,
): ContentSearchResult[] {
  const result: ContentSearchResult[] = [];

  const docModels = documentModelManager.getAllModel();

  docModels.forEach((docModel: IDocumentModel) => {
    if (!docModel.dirty) {
      return;
    }
    const textModel = docModel.toEditor();
    const findResults = textModel.findMatches(searchValue,
      true,
      !!searchOptions.useRegExp,
      !!searchOptions.matchCase,
      !!searchOptions.matchWholeWord ? ' \n' : null,
      false,
    );
    findResults.forEach((find: monaco.editor.FindMatch) => {
      result.push({
        root: '',
        fileUri: docModel.uri.toString(),
        line: find.range.startLineNumber,
        matchStart: find.range.startColumn,
        matchLength: find.range.endColumn - find.range.startColumn,
        lineText: textModel.getLineContent(find.range.startLineNumber),
      });
    });
  });

  return result;
}

function mergeSameUriResult(
  data: ContentSearchResult[],
  searchResultMap: Map<string, ContentSearchResult[]>,
  total?: ResultTotal,
) {
  const theTotal = total || { fileNum: 0, resultNum: 0};
  data.forEach((result: ContentSearchResult) => {
    const oldData: ContentSearchResult[] | undefined = searchResultMap.get(result.fileUri);

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

/**
 * 分批次接收处理搜索结果
 */
function useSearchResult(host) {
  const [searchResults, setSearchResults] = React.useState(null as Map<string, ContentSearchResult[]> | null);
  const [searchState, setSearchState] = React.useState(SEARCH_STATE.todo);
  const [searchError, setSearchError] = React.useState('');
  const [resultTotal, setResultTotal] = React.useState({ fileNum: 0, resultNum: 0 } as ResultTotal);

  React.useEffect(() => {
    let tempSearchResults: Map<string, ContentSearchResult[]>;
    let tempResultTotal: ResultTotal;

    const clear = () => {
      tempSearchResults = new Map();
      tempResultTotal = { fileNum: 0, resultNum: 0 };
    };
    clear();
    host.onResult((newResult: SendClientResult) => {
      const { id, data, searchState, error } = newResult;
      if (!data) {
        return;
      }

      if (currentSearchID && id > currentSearchID) {
        // 新的搜索开始了
        clear();
      }
      if (currentSearchID && currentSearchID > id) {
        // 若存在异步发送的上次搜索结果，丢弃上次搜索的结果
        return;
      }

      if (searchState) {
        setSearchState(searchState);
        if (searchState === SEARCH_STATE.doing) {
          // 新的搜索开始了
          clear();
        }
        if (searchState === SEARCH_STATE.done || searchState === SEARCH_STATE.error) {
          // 搜索结束 清理ID
          currentSearchID = null;
        }
      }
      if (error) {
        setSearchError(error);
      }
      const result = mergeSameUriResult(data, tempSearchResults, tempResultTotal);
      tempSearchResults = result.searchResultMap;
      tempResultTotal = result.total;
      setSearchResults(tempSearchResults);
      setResultTotal(tempResultTotal);
    });
  }, []);

  return {
    searchResults,
    setSearchResults,
    searchState,
    setSearchState,
    searchError,
    setSearchError,
    resultTotal,
    setResultTotal,
  };
}

function getSearchMenu(options: {
  searchValue: string,
  clear: any,
  searchState: SEARCH_STATE,
  searchInWorkspaceServer: IContentSearchServer,
}) {
  const {
    searchValue,
    clear,
    searchState,
    searchInWorkspaceServer,
  } = options;
  const list = [
    {
      icon: 'fold',
      title: 'fold',
      onClick: () => {},
      getClassName: () => '',
    }, {
      icon: 'search_close',
      title: 'close',
      getClassName: (): string => {
        return searchValue ? styles.menu_active : '';
      },
      onClick: () => {
        clear();
      },
    },
    {
      icon: '',
      title: 'refresh',
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

function getResultTotal(total: ResultTotal) {
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

  function updateUIState(obj, e?: React.KeyboardEvent | React.MouseEvent) {
    setUIState(Object.assign({}, UIState, obj));
    if (!e) { return; }
    search(e);
  }

  const search =  (e: React.KeyboardEvent | React.MouseEvent) => {
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

    if ((e as any).keyCode !== undefined && Key.ENTER.keyCode !== (e as any).keyCode) {
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
    const searchFromDocModelResult = searchFromDocModel(value, searchOptions, documentModelManager);
    // Get result from search service
    searchInWorkspaceServer.search(value, [workspaceDir], searchOptions).then((id) => {
      currentSearchID = id;
      searchBrowserService.onSearchResult({
        id,
        data: searchFromDocModelResult,
        searchState: SEARCH_STATE.doing,
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
    setResultTotal({} as ResultTotal);
  }

  React.useEffect(() => {
    setSearchPanelLayout({
      width: searchOptionRef.current && searchOptionRef.current.clientWidth || 0,
      height: searchOptionRef.current && searchOptionRef.current.clientHeight || 0,
    });
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.search_options} ref={searchOptionRef}>
        <div className={styles.header}>
          <span>SEARCH</span>
          {getSearchMenu({
            searchValue,
            clear,
            searchState,
            searchInWorkspaceServer,
          })}
        </div>
        <div className={styles.search_and_replace_container}>
          <div
            title='Toggle Replace'
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
                  title='Search'
                  type='text'
                  placeholder='Search'
                  onFocus={() => updateUIState({ isSearchFocus: true })}
                  // onBlur={() => updateUIState({ isSearchFocus: false })}
                  onKeyUp={search}
                  onChange={onSearchInputChange}
                  ref={(el) => searchInputEl = el}
                />
                <div className={styles.option_buttons}>
                  <span
                    className={cls('volans_icon ab', styles['match-case'], styles.option, { [styles.select]: UIState.isMatchCase })}
                    title='Match Case'
                    onClick={(e) => updateUIState({ isMatchCase: !UIState.isMatchCase }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon abl', styles['whole-word'], styles.option, { [styles.select]: UIState.isWholeWord })}
                    title='Match Whole Word'
                    onClick={(e) => updateUIState({ isWholeWord: !UIState.isWholeWord }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon holomorphy', styles['use-regexp'], styles.option, { [styles.select]: UIState.isUseRegexp })}
                    title='Use Regular Expression'
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
                title='Replace'
                type='text'
                placeholder='Replace'
                ref={(el) => replaceInputEl = el}
              />
              <div className={styles['replace-all-button_container']}>
                <span title='Replace All' className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
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
                <div className={cls(styles.label)}>files to include</div>
                <input
                  type='text'
                  ref={(el) => includeInputEl = el}
                />
              </div>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}>files to exclude</div>
                <input
                  type='text'
                  ref={(el) => excludeInputEl = el}
                />
              </div>
            </div> : ''
          }
        </div>

      </div>
      {getResultTotal(resultTotal)}
      {
        (searchResults && searchResults.size > 0) ? <SearchTree
          searchPanelLayout = {searchPanelLayout}
          searchResults={searchResults}
          searchValue={searchValue}
          searchState={searchState}
        /> : <div className={styles.result_describe}>
          {searchState === SEARCH_STATE.done ? 'No results found.' : ''}
        </div>
      }
    </div >
  );
});
