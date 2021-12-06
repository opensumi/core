import React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, localize } from '@opensumi/ide-core-browser';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';
import { Input, CheckBox, Popover, PopoverTriggerType, PopoverPosition } from '@opensumi/ide-components';
import { ViewState } from '@opensumi/ide-core-browser';
import { getIcon, getExternalIcon } from '@opensumi/ide-core-browser';
import cls from 'classnames';
import styles from './search.module.less';
import {
  SEARCH_STATE,
} from '../common/';
import { ContentSearchClientService } from './search.service';
import { SearchTree } from './search-tree.view';
import { SearchInputWidget } from './search.input.widget';
import { SearchReplaceWidget } from './search.replace.widget';

const IncludeRuleContent = React.memo(() => (
  <div className={cls(styles.include_rule_content)}>
    <ul>
      <li>, : {localize('search.help.concatRule')}</li>
      <li>* : {localize('search.help.matchOneOrMoreRule')}</li>
      <li>? : {localize('search.help.matchOne')}</li>
      <li>** : {localize('search.help.matchAny')}</li>
      <li>{} : {localize('search.help.matchWithGroup')}</li>
      <li>[] : {localize('search.help.matchRange')}</li>
    </ul>
  </div>
));

const ExcludeRuleContent = React.memo(() => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const searchBrowserService = injector.get(ContentSearchClientService);
  const excludeList = React.useMemo(() => {
    return searchBrowserService.getPreferenceSearchExcludes();
  }, [searchBrowserService]);

  return (<div className={cls(styles.exclude_rule_content)}>
    <div>
      {excludeList.map((exclude, index) => {
        if (index === excludeList.length - 1) {
          return exclude;
        }
        return `${exclude}, `;
      })}
    </div>
  </div>);
});

export const Search = React.memo(observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>,
) => {
  const searchOptionRef = React.createRef<HTMLDivElement>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const searchBrowserService = injector.get(ContentSearchClientService);
  const [searchPanelLayout, setSearchPanelLayout] = React.useState({ height: 0, width: 0 });
  const searchTreeRef = React.useRef();

  const searchResults = searchBrowserService.searchResults;
  const resultTotal = searchBrowserService.resultTotal;
  const searchState = searchBrowserService.searchState;
  const doReplaceAll = searchBrowserService.doReplaceAll;
  const updateUIState = searchBrowserService.updateUIState;
  const UIState = searchBrowserService.UIState;
  const searchError = searchBrowserService.searchError;
  const isSearchDoing = searchBrowserService.isSearchDoing;
  const validateMessage = searchBrowserService.validateMessage;
  const isShowValidateMessage = searchBrowserService.isShowValidateMessage;

  const onDetailToggle = React.useCallback(() => {
    updateUIState({ isDetailOpen: !UIState.isDetailOpen });
  }, [UIState]);

  const onSearchFocus = React.useCallback(() => {
    updateUIState({ searchFocus: true });
  }, []);

  const onSearchBlur = React.useCallback(() => {
    updateUIState({ searchFocus: false });
  }, []);

  const onMatchCaseToggle = React.useCallback(() => {
    updateUIState({ isMatchCase: !UIState.isMatchCase });
  }, [UIState]);

  const onRegexToggle = React.useCallback(() => {
    updateUIState({ isRegexp: !UIState.isUseRegexp });
  }, [UIState]);

  const onWholeWordToggle = React.useCallback(() => {
    updateUIState({ isRegexp: !UIState.isUseRegexp });
  }, [UIState]);

  React.useEffect(() => {
    setSearchPanelLayout({
      width: searchOptionRef.current && searchOptionRef.current.clientWidth || 0,
      height: searchOptionRef.current && searchOptionRef.current.clientHeight || 0,
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
          resultCount={resultTotal.resultNum}
        />

        <div className={cls(styles.search_details)}>
          {UIState.isDetailOpen ?
            <div className='glob_field-container'>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}>
                  <span className={styles.limit}>{localize('search.includes')}</span>
                  <span className={cls(styles.include_rule)}>
                    <Popover
                      id={'show_include_rule'}
                      title={localize('search.help.supportRule')}
                      content={<IncludeRuleContent />}
                      trigger={PopoverTriggerType.hover}
                      delay={500}
                      position={PopoverPosition.right}
                    >
                      <a>{localize('search.help.showIncludeRule')}</a>
                    </Popover>
                  </span>
                </div>
                <Input
                  value={searchBrowserService.includeValue}
                  type='text'
                  placeholder={localize('search.includes.description')}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchIncludeChange}
                  addonAfter={[
                    <span
                      key='onlyOpenEditors'
                      className={cls(getExternalIcon('book'), styles.search_option, { [styles.select]: UIState.isOnlyOpenEditors })}
                      title={localize('onlyOpenEditors')}
                      onClick={(e) => updateUIState({ isOnlyOpenEditors: !UIState.isOnlyOpenEditors }, e)}
                    />,
                  ]}
                />
              </div>
              <div className={cls(styles.glob_field, styles.search_excludes)}>
                <div className={styles.label}>
                  <span className={styles.limit}>{localize('search.excludes')}</span>
                  <div className={styles.checkbox_wrap}>
                    <CheckBox
                      className={cls(styles.checkbox)}
                      label={localize('search.excludes.default.enable')}
                      checked={!UIState.isIncludeIgnored}
                      id='search-input-isIncludeIgnored'
                      onChange={() => { updateUIState({ isIncludeIgnored: !UIState.isIncludeIgnored }); }}
                    />
                    <Popover
                      title={localize('search.help.excludeList')}
                      className={cls(styles.search_excludes_description)}
                      id={'search_excludes'}
                      action={localize('search.help.modify')}
                      onClickAction={searchBrowserService.openPreference}
                      content={<ExcludeRuleContent />}
                      trigger={PopoverTriggerType.hover}
                      delay={500}
                      position={PopoverPosition.right}
                    >
                      <span className={cls(getIcon('question-circle'))} style={{ opacity: '0.7', cursor: 'pointer' }}></span>
                    </Popover>
                  </div>

                </div>
                <Input
                  type='text'
                  value={searchBrowserService.excludeValue}
                  placeholder={localize('search.includes.description')}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchExcludeChange}
                />
              </div>
            </div> : ''
          }
        </div>

      </div>
      {
        (searchResults && searchResults.size > 0 && !searchError ) ? <SearchTree
          searchPanelLayout={searchPanelLayout}
          viewState={viewState}
          ref={searchTreeRef}
        /> : <div
              className={cls(
                { [styles.result_describe]: searchState === SEARCH_STATE.done },
                { [styles.result_error]: searchState === SEARCH_STATE.error || searchError },
              )}
            >
            {
              searchState === SEARCH_STATE.done && !searchError ? localize('noResultsFound').replace('-', '') : ''
            }
            { searchError }
          </div>
      }
    </div >
  );
}));
