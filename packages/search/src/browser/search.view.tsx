import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext, ContextKeyNotEqualsExpr } from '@ali/ide-core-browser';
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

/**
 * 分批次接收处理搜索结果
 */
function useSearchResult(host) {
  const [searchResults, setSearchResults] = React.useState(null as Map<string, ContentSearchResult[]> | null);
  const [searchState, setSearchState] = React.useState(SEARCH_STATE.todo);
  const [searchError, setSearchError] = React.useState('');
  const [resultTotal, setResultTotal] = React.useState({} as ResultTotal);

  React.useEffect(() => {
    const searchResultMap: Map<string, ContentSearchResult[]> = new Map();
    let total: ResultTotal = {fileNum: 0 , resultNum: 0};
    const clear = () => {
       searchResultMap.clear();
       total = {fileNum: 0 , resultNum: 0};
    };

    host.onResult((newResult: SendClientResult) => {
      const { id, data, searchState, error } = newResult;

      if (!currentSearchID) {
        // 开始第一次或者新的搜索（第一次判断）
        currentSearchID = id;
        clear();
      }

      if (currentSearchID && currentSearchID !== id) {
        // 开始第一次或者新的搜索 （第二次次判断）
        currentSearchID = id;
        clear();
      } else {
        if (searchState) {
          setSearchState(searchState);
          if (searchState === SEARCH_STATE.done || searchState === SEARCH_STATE.error) {
            // 搜索结束 清理ID
            currentSearchID = null;
          }
        }
        if (error) {
          setSearchError(error);
        }
      }

      data.forEach((result: ContentSearchResult) => {
        const oldData: ContentSearchResult[] | undefined = searchResultMap.get(result.fileUri);

        if (oldData) {
          oldData.push(result);
          searchResultMap.set(result.fileUri, oldData);
          total.resultNum ++;
        } else {
          searchResultMap.set(result.fileUri, [result]);
          total.fileNum ++;
          total.resultNum ++;
        }
      });

      setSearchResults(searchResultMap);
      setResultTotal({
        fileNum: total.fileNum,
        resultNum: total.resultNum,
      });
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
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const searchInWorkspaceServer: IContentSearchServer = injector.get(ContentSearchServerPath);
  const searchBrowserService = injector.get(SearchBrowserService);
  const {
    searchResults,
    setSearchResults,
    searchState,
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

  function updateUIState(obj, e?: React.KeyboardEvent | React.MouseEvent) {
    setUIState(Object.assign({}, UIState, obj));
    if (!e) { return; }
    search(e);
  }

  function search(e: React.KeyboardEvent | React.MouseEvent) {
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

    if (!value) {
      return clear();
    }

    if ((e as any).keyCode !== undefined && Key.ENTER.keyCode !== (e as any).keyCode) {
      return;
    }
    searchInWorkspaceServer.search(value, [workspaceDir], searchOptions).then((id) => {
      currentSearchID = id;
    });
  }

  function onSearchInputChange(e: React.FormEvent<HTMLInputElement>) {
    setSearchValue((e.currentTarget.value || '').trim());
  }

  function clear() {
    setSearchResults(null);
    setSearchValue('');
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

  return (
    <div className={styles.wrap}>
      <div className={styles.search_options}>
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
                  onBlur={() => updateUIState({ isSearchFocus: false })}
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
      <SearchTree
        searchResults={searchResults}
        searchValue={searchValue}
        searchState={searchState}
      />
    </div >
  );
});
