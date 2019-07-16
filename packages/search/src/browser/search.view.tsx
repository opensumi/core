import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext } from '@ali/ide-core-browser';
import * as cls from 'classnames';
import * as styles from './search.module.less';
import {
  IContentSearchServer,
  ContentSearchServerPath,
  ContentSearchOptions,
  ContentSearchResult,
  SEARCH_STATE,
} from '../common/';
import { SearchBrowserService } from './search.service';
import { SearchTree } from './search-tree.view';

function splitOnComma(patterns: string): string[] {
  return patterns.length > 0 ? patterns.split(',').map((s) => s.trim()) : [];
}

function useSearchResult(host) {
  const [searchResults, setSearchResults] = React.useState(null as ContentSearchResult[] | null);

  React.useEffect(() => {
    let results = [];
    let oldId: number = -1;
    host.onResult((newResult) => {
      // TODO filter ID
      if (oldId !== newResult.id) {
        oldId = newResult.id;
        results = [];
      }
      results = results.concat(newResult.data);
      setSearchResults(results);
    });
  }, []);

  return {
    searchResults,
    setSearchResults,
  };
}

export const Search = observer(() => {
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const searchInWorkspaceServer: IContentSearchServer  = injector.get(ContentSearchServerPath);
  const searchBrowserService = injector.get(SearchBrowserService);
  const { searchResults, setSearchResults } = useSearchResult(searchBrowserService);
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
  const [searchState, setSearchState] = React.useState(SEARCH_STATE.todo);

  function updateUIState(obj, e?: React.KeyboardEvent | React.MouseEvent ) {
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
    setSearchState(SEARCH_STATE.doing);
    searchInWorkspaceServer.search(value, [workspaceDir], searchOptions);
  }

  function onSearchInputChange(e: React.FormEvent<HTMLInputElement>) {
    setSearchValue((e.currentTarget.value || '').trim());
  }

  function clear() {
    setSearchResults(null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span>SEARCH</span>
      </div>
      <div className={styles['search-and-replace-container']}>
        <div
          title='Toggle Replace'
          className={cls(styles['replace-toggle'], {[styles['toggle-open']]: UIState.isToggleOpen })}
          onClick={() => updateUIState({isToggleOpen: !UIState.isToggleOpen})}
        >
          <span className={cls('fa', {['fa-caret-down']: UIState.isToggleOpen, ['fa-caret-right']: !UIState.isToggleOpen})}></span>
        </div>
        <div className={styles['search-and-replace-fields']}>
          <div className={styles['search-field-container']}>
            <div className={cls(styles['search-field'], {[styles.focus]: UIState.isSearchFocus})}>
              <input
                id='search-input-field'
                title='Search'
                type='text'
                placeholder='Search'
                onFocus={() => updateUIState({ isSearchFocus: true})}
                onBlur={() => updateUIState({ isSearchFocus: false})}
                onKeyUp={search}
                onChange={onSearchInputChange}
                ref={(el) => searchInputEl = el}
              />
              <div className={styles['option-buttons']}>
                <span
                  className={cls('volans_icon ab', styles['match-case'], styles.option, {[styles.select]:  UIState.isMatchCase})}
                  title='Match Case'
                  onClick={(e) => updateUIState({isMatchCase: !UIState.isMatchCase}, e)}
                ></span>
                <span
                  className={cls('volans_icon abl', styles['whole-word'], styles.option, {[styles.select]:  UIState.isWholeWord})}
                  title='Match Whole Word'
                  onClick={(e) => updateUIState({isWholeWord: !UIState.isWholeWord}, e)}
                ></span>
                <span
                  className={cls('volans_icon holomorphy', styles['use-regexp'], styles.option, {[styles.select]:  UIState.isUseRegexp})}
                  title='Use Regular Expression'
                  onClick={(e) => updateUIState({isUseRegexp: !UIState.isUseRegexp}, e)}
                ></span>
                <span
                  className={cls('fa fa-eye', styles['include-ignored'], styles.option, {[styles.select]:  UIState.isIncludeIgnored})}
                  title='Include Ignored Files'
                  onClick={(e) => updateUIState({isIncludeIgnored: !UIState.isIncludeIgnored}, e)}
                ></span>
              </div>
            </div>
            {/* <div className='search-notification '>
              <div>This is only a subset of all results. Use a more specific search term to narrow down the result list.</div>
            </div> */}
            </div>
            { UIState.isToggleOpen ? <div className={styles['replace-field']}>
                <input
                  id='replace-input-field'
                  title='Replace'
                  type='text'
                  placeholder='Replace'
                  ref={(el) => replaceInputEl = el}
                />
                <div className={styles['replace-all-button-container']}>
                <span title='Replace All' className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
              </div>
            </div> : ''
            }
        </div>
      </div>

      <div className={cls(styles['search-details'])}>
        <div
          className={cls(styles['button-container'])}
          onClick={() => updateUIState({ isDetailOpen: !UIState.isDetailOpen})}
        >
          <span className='fa fa-ellipsis-h'></span>
        </div>
        {UIState.isDetailOpen ?
          <div className='glob-field-container'>
            <div className={cls(styles['glob-field'])}>
              <div className={cls(styles.label)}>files to include</div>
                <input
                  type='text'
                  ref={(el) => includeInputEl = el}
                />
              </div>
            <div className={cls(styles['glob-field'])}>
              <div className={cls(styles.label)}>files to exclude</div>
              <input
                type='text'
                ref={(el) => excludeInputEl = el}
              />
            </div>
          </div> : ''
        }
      </div>

      <SearchTree
        searchResults={searchResults}
        searchValue={searchValue}
        searchState={searchState}
      />
    </div >
  );
});
