import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { ViewState } from '@opensumi/ide-core-browser';
import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';

import { SEARCH_STATE } from '../common/';

import { SearchTree } from './search-tree.view';
import { SearchInputWidget } from './search.input.widget';
import styles from './search.module.less';
import { SearchReplaceWidget } from './search.replace.widget';
import { SearchRulesWidget } from './search.rules.widget';
import { ContentSearchClientService } from './search.service';

export const Search = React.memo(
  observer(({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
    const searchOptionRef = React.createRef<HTMLDivElement>();
    const searchBrowserService = useInjectable<ContentSearchClientService>(ContentSearchClientService);
    const [searchPanelLayout, setSearchPanelLayout] = React.useState({ height: 0, width: 0 });
    const {
      searchResults,
      resultTotal,
      searchState,
      doReplaceAll,
      updateUIState,
      UIState,
      searchError,
      isSearchDoing,
      validateMessage,
      isShowValidateMessage,
    } = searchBrowserService;

    const onDetailToggle = React.useCallback(() => {
      updateUIState({ isDetailOpen: !UIState.isDetailOpen });
    }, [UIState]);

    const onSearchFocus = React.useCallback(() => {
      updateUIState({ isSearchFocus: true });
    }, []);

    const onSearchBlur = React.useCallback(() => {
      updateUIState({ isSearchFocus: false });
    }, []);

    const onMatchCaseToggle = React.useCallback(() => {
      updateUIState({ isMatchCase: !UIState.isMatchCase });
    }, [UIState]);

    const onRegexToggle = React.useCallback(() => {
      updateUIState({ isUseRegexp: !UIState.isUseRegexp });
    }, [UIState]);

    const onWholeWordToggle = React.useCallback(() => {
      updateUIState({ isWholeWord: !UIState.isWholeWord });
    }, [UIState]);

    const onOnlyOpenEditorsToggle = React.useCallback(() => {
      updateUIState({ isOnlyOpenEditors: !UIState.isOnlyOpenEditors });
    }, [UIState]);

    const onIncludeIgnoredToggle = React.useCallback(() => {
      updateUIState({ isIncludeIgnored: !UIState.isIncludeIgnored });
    }, [UIState]);

    React.useEffect(() => {
      setSearchPanelLayout({
        width: (searchOptionRef.current && searchOptionRef.current.clientWidth) || 0,
        height: (searchOptionRef.current && searchOptionRef.current.clientHeight) || 0,
      });
    }, [UIState, searchOptionRef.current, searchResults.size > 0]);

    const collapsePanelContainerStyle = {
      width: viewState.width || '100%',
      height: viewState.height,
    };

    const SearchProcess = React.useMemo(
      () => (
        <div className={styles['loading-wrap']}>
          <ProgressBar loading={isSearchDoing} />
        </div>
      ),
      [isSearchDoing],
    );

    const onSearch = searchBrowserService.search.bind(searchBrowserService);

    return (
      <div className={styles.wrap} style={collapsePanelContainerStyle}>
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
            isShowValidateMessage={isShowValidateMessage}
            validateMessage={validateMessage}
            onSearchFocus={onSearchFocus}
            onSearchBlur={onSearchBlur}
            searchInputEl={searchBrowserService.searchInputEl}
            searchValue={searchBrowserService.searchValue}
            onSearchInputChange={searchBrowserService.onSearchInputChange}
            onSearch={onSearch}
          />

          <SearchReplaceWidget
            replaceValue={searchBrowserService.replaceValue}
            onSearch={onSearch}
            onReplaceRuleChange={searchBrowserService.onReplaceInputChange}
            replaceInputEl={searchBrowserService.replaceInputEl}
            doReplaceAll={doReplaceAll}
            resultTotal={resultTotal}
          />

          <div className={cls(styles.search_details)}>
            {UIState.isDetailOpen && (
              <SearchRulesWidget
                includeValue={searchBrowserService.includeValue}
                excludeValue={searchBrowserService.excludeValue}
                onSearch={onSearch}
                onChangeInclude={searchBrowserService.onSearchIncludeChange}
                onChangeExclude={searchBrowserService.onSearchExcludeChange}
                isOnlyOpenEditors={UIState.isOnlyOpenEditors}
                isIncludeIgnored={UIState.isIncludeIgnored}
                onOnlyOpenEditorsToggle={onOnlyOpenEditorsToggle}
                onIncludeIgnoredToggle={onIncludeIgnoredToggle}
                onOpenPreference={searchBrowserService.openPreference}
              />
            )}
          </div>
        </div>
        {!isSearchDoing &&
          (searchError || searchState === SEARCH_STATE.error ? (
            <div className={styles.result_error}>{searchError}</div>
          ) : searchResults && searchResults.size > 0 ? (
            <SearchTree searchPanelLayout={searchPanelLayout} viewState={viewState} />
          ) : searchState === SEARCH_STATE.done ? (
            <div className={styles.result_describe}>
              {searchBrowserService.searchValue && localize('noResultsFound')}
            </div>
          ) : (
            ''
          ))}
      </div>
    );
  }),
);
