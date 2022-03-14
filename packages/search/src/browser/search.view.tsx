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
    const searchBrowserService = useInjectable(ContentSearchClientService);
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
    return (
      <div className={styles.wrap} style={collapsePanelContainerStyle}>
        <div className={styles['loading-wrap']}>
          <ProgressBar loading={isSearchDoing} />
        </div>
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
            onSearch={searchBrowserService.search}
          />

          <SearchReplaceWidget
            replaceValue={searchBrowserService.replaceValue}
            onSearch={searchBrowserService.search}
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
                onSearch={searchBrowserService.search}
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
        {searchResults && searchResults.size > 0 && !searchError ? (
          <SearchTree searchPanelLayout={searchPanelLayout} viewState={viewState} />
        ) : (
          <div
            className={cls(
              { [styles.result_describe]: searchState === SEARCH_STATE.done },
              { [styles.result_error]: searchState === SEARCH_STATE.error || searchError },
            )}
          >
            {searchState === SEARCH_STATE.done && !searchError ? localize('noResultsFound').replace('-', '') : ''}
            {searchError}
          </div>
        )}
      </div>
    );
  }),
);
