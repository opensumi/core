import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, {
  memo,
  useCallback,
  PropsWithChildren,
  createRef,
  useState,
  useMemo,
  useEffect,
  FormEvent,
  useRef,
} from 'react';

import { ValidateMessage } from '@opensumi/ide-components';
import { DisposableCollection, Key, ViewState } from '@opensumi/ide-core-browser';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';

import {
  ContentSearchResult,
  IContentSearchClientService,
  ISearchTreeService,
  ResultTotal,
  SEARCH_STATE,
} from '../common/';

import { SearchInputWidget } from './search.input.widget';
import styles from './search.module.less';
import { SearchReplaceWidget } from './search.replace.widget';
import { SearchRulesWidget } from './search.rules.widget';
import { SearchTree } from './tree/search-tree.view';

export interface ISearchContentResult {
  results: Map<string, ContentSearchResult[]>;
  total: ResultTotal;
  isSearching: boolean;
  state: SEARCH_STATE;
  searchError: string;
  isShowValidateMessage: boolean;
  validateMessage?: ValidateMessage;
}

export const Search = memo(
  observer(({ viewState }: PropsWithChildren<{ viewState: ViewState }>) => {
    const searchOptionRef = createRef<HTMLDivElement>();
    const wrapperRef = createRef<HTMLDivElement>();
    const searchTreeService = useInjectable<ISearchTreeService>(ISearchTreeService);
    const searchBrowserService = useInjectable<IContentSearchClientService>(IContentSearchClientService);
    const [offsetTop, setOffsetTop] = useState<number>(0);
    const [searchContent, setSearchContent] = useState<ISearchContentResult>({
      results: new Map(),
      total: { resultNum: 0, fileNum: 0 },
      isSearching: false,
      state: SEARCH_STATE.done,
      searchError: '',
      isShowValidateMessage: false,
    });
    const [replace, setReplace] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const { doReplaceAll, updateUIState, UIState } = searchBrowserService;

    const disposable = useRef<DisposableCollection>(new DisposableCollection());

    const onDetailToggle = useCallback(() => {
      updateUIState({ isDetailOpen: !UIState.isDetailOpen });
    }, [UIState]);

    const onSearchFocus = useCallback(() => {
      updateUIState({ isSearchFocus: true });
    }, []);

    const onSearchBlur = useCallback(() => {
      updateUIState({ isSearchFocus: false });
    }, []);

    const onMatchCaseToggle = useCallback(() => {
      updateUIState({ isMatchCase: !UIState.isMatchCase });
    }, [UIState]);

    const onRegexToggle = useCallback(() => {
      updateUIState({ isUseRegexp: !UIState.isUseRegexp });
    }, [UIState]);

    const onWholeWordToggle = useCallback(() => {
      updateUIState({ isWholeWord: !UIState.isWholeWord });
    }, [UIState]);

    const onOnlyOpenEditorsToggle = useCallback(() => {
      updateUIState({ isOnlyOpenEditors: !UIState.isOnlyOpenEditors });
    }, [UIState]);

    const onIncludeIgnoredToggle = useCallback(() => {
      updateUIState({ isIncludeIgnored: !UIState.isIncludeIgnored });
    }, [UIState]);

    useEffect(() => {
      setOffsetTop((searchOptionRef.current && searchOptionRef.current.clientHeight) || 0);
    }, [offsetTop, searchOptionRef.current, searchContent]);

    const collapsePanelContainerStyle = {
      width: viewState.width || '100%',
      height: viewState.height,
    };

    const SearchProcess = useMemo(
      () => (
        <div className={styles['loading-wrap']}>
          <ProgressBar loading={searchContent.isSearching} />
        </div>
      ),
      [searchContent],
    );

    const onSearch = useCallback(
      (e?: KeyboardEvent) => {
        if (e && e.key !== Key.ENTER.code) {
          return;
        }
        searchBrowserService.search();
      },
      [searchBrowserService],
    );

    const onSearchInputChange = useCallback(
      (e: FormEvent<HTMLInputElement>) => {
        searchBrowserService.onSearchInputChange(e.currentTarget.value || '');
        setSearch(e.currentTarget.value);
      },
      [searchBrowserService],
    );

    const onSearchIncludeChange = useCallback(
      (e: FormEvent<HTMLInputElement>) => {
        searchBrowserService.onSearchIncludeChange(e.currentTarget.value || '');
      },
      [searchBrowserService],
    );

    const onSearchExcludeChange = useCallback(
      (e: FormEvent<HTMLInputElement>) => {
        searchBrowserService.onSearchExcludeChange(e.currentTarget.value || '');
      },
      [searchBrowserService],
    );

    const onReplaceInputChange = useCallback(
      (e: FormEvent<HTMLInputElement>) => {
        searchBrowserService.onReplaceInputChange(e.currentTarget.value || '');
        setReplace(e.currentTarget.value);
      },
      [searchBrowserService],
    );

    const updateSearchContent = useCallback(() => {
      setSearchContent({
        results: searchBrowserService.searchResults,
        total: searchBrowserService.resultTotal,
        isSearching: searchBrowserService.isSearching,
        state: searchBrowserService.searchState,
        searchError: searchBrowserService.searchError,
        isShowValidateMessage: searchBrowserService.isShowValidateMessage,
        validateMessage: searchBrowserService.validateMessage,
      });
    }, [searchContent, searchBrowserService]);

    useEffect(() => {
      disposable.current.push(searchBrowserService.onDidChange(updateSearchContent));
      return () => {
        disposable.current.dispose();
      };
    }, []);

    useEffect(() => {
      if (wrapperRef.current) {
        searchTreeService.initContextKey(wrapperRef.current);
      }
    }, [wrapperRef.current]);

    const renderSearchTreeView = useCallback(() => {
      if (searchContent.results.size > 0) {
        return (
          <SearchTree
            offsetTop={offsetTop}
            viewState={viewState}
            state={searchContent.state}
            total={searchContent.total}
            search={search}
            replace={replace}
          />
        );
      } else {
        if (searchContent.state === SEARCH_STATE.done) {
          <div className={styles.result_describe}>{search && localize('noResultsFound')}</div>;
        }
        return null;
      }
    }, [searchContent, searchBrowserService, search, replace]);

    const renderSearchResults = useCallback(() => {
      if (searchContent.searchError || searchContent.state === SEARCH_STATE.error) {
        return <div className={styles.result_error}>{searchContent.searchError}</div>;
      } else {
        return renderSearchTreeView();
      }
    }, [searchContent, search, replace]);

    return (
      <div className={styles.search_container} style={collapsePanelContainerStyle} ref={wrapperRef}>
        {SearchProcess}
        <div className={styles.search_options} ref={searchOptionRef}>
          <SearchInputWidget
            isDetailOpen={UIState.isDetailOpen}
            onDetailToggle={onDetailToggle}
            isMatchCase={UIState.isMatchCase}
            onMatchCaseToggle={onMatchCaseToggle}
            isRegex={UIState.isUseRegexp}
            onRegexToggle={onRegexToggle}
            isWholeWord={UIState.isWholeWord}
            onWholeWordToggle={onWholeWordToggle}
            isSearchFocus={UIState.isSearchFocus}
            isShowValidateMessage={searchContent.isShowValidateMessage}
            validateMessage={searchContent.validateMessage}
            onSearchFocus={onSearchFocus}
            onSearchBlur={onSearchBlur}
            searchInputEl={searchBrowserService.searchInputEl}
            searchValue={searchBrowserService.searchValue}
            onSearchInputChange={onSearchInputChange}
            onSearch={onSearch}
          />

          <SearchReplaceWidget
            replaceValue={searchBrowserService.replaceValue}
            onSearch={onSearch}
            onReplaceRuleChange={onReplaceInputChange}
            doReplaceAll={doReplaceAll}
            resultTotal={searchContent.total}
          />

          <div className={cls(styles.search_details)}>
            {UIState.isDetailOpen && (
              <SearchRulesWidget
                includeValue={searchBrowserService.includeValue}
                excludeValue={searchBrowserService.excludeValue}
                onSearch={onSearch}
                onChangeInclude={onSearchIncludeChange}
                onChangeExclude={onSearchExcludeChange}
                isOnlyOpenEditors={UIState.isOnlyOpenEditors}
                isIncludeIgnored={UIState.isIncludeIgnored}
                onOnlyOpenEditorsToggle={onOnlyOpenEditorsToggle}
                onIncludeIgnoredToggle={onIncludeIgnoredToggle}
                onOpenPreference={searchBrowserService.openPreference}
              />
            )}
          </div>
        </div>
        {renderSearchResults()}
      </div>
    );
  }),
);
