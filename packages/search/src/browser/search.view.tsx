import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, localize } from '@ali/ide-core-browser';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import { Input, ValidateInput, CheckBox, Popover, PopoverTriggerType, PopoverPosition } from '@ali/ide-components';
import { ViewState } from '@ali/ide-core-browser';
import { getIcon, getExternalIcon } from '@ali/ide-core-browser';
import * as cls from 'classnames';
import * as styles from './search.module.less';
import {
  SEARCH_STATE,
} from '../common/';
import { ContentSearchClientService } from './search.service';
import { SearchTree } from './search-tree.view';

function getIncludeRuleContent() {
  return (
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
  );
}

function getExcludeRuleContent(excludeList: string[]) {
  return (
    <div className={cls(styles.exclude_rule_content)}>
      <div>
        {excludeList.map((exclude, index) => {
          if (index === excludeList.length - 1) {
            return exclude;
          }
          return `${exclude}, `;
        })}
      </div>
    </div>
  );
}

export const Search = observer(({
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
        <div className={styles.search_and_replace_container}>
          <div className={styles.search_and_replace_fields}>
            <div className={styles.search_field_container}>
              <p className={styles.search_input_title}>
                {localize('search.input.title')}
                <CheckBox
                  insertClass={cls(styles.checkbox)}
                  label={localize('search.input.checkbox')}
                  checked={UIState.isDetailOpen}
                  id='search-input'
                  onChange={() => { updateUIState({ isDetailOpen: !UIState.isDetailOpen }); }}
                />
              </p>
              <div className={cls(styles.search_field, { [styles.focus]: UIState.isSearchFocus })}>
                <ValidateInput
                  id='search-input-field'
                  title={localize('search.input.placeholder')}
                  type='text'
                  value={searchBrowserService.searchValue}
                  placeholder={localize('search.input.title')}
                  onFocus={() => updateUIState({ isSearchFocus: true })}
                  onBlur={() => updateUIState({ isSearchFocus: false })}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchInputChange}
                  ref={searchBrowserService.searchInputEl}
                  validateMessage={isShowValidateMessage ? validateMessage : undefined }
                  addonAfter={[
                    <span
                    key={localize('caseDescription')}
                    className={cls(getIcon('ab'), styles['match-case'], styles.search_option, { [styles.select]: UIState.isMatchCase })}
                    title={localize('caseDescription')}
                    onClick={(e) => updateUIState({ isMatchCase: !UIState.isMatchCase }, e)}
                  ></span>,
                  <span
                    key={localize('wordsDescription')}
                    className={cls(getIcon('abl'), styles['whole-word'], styles.search_option, { [styles.select]: UIState.isWholeWord })}
                    title={localize('wordsDescription')}
                    onClick={(e) => updateUIState({ isWholeWord: !UIState.isWholeWord }, e)}
                  ></span>,
                  <span
                    key={localize('regexDescription')}
                    className={cls(getIcon('regex'), styles['use-regexp'], styles.search_option, { [styles.select]: UIState.isUseRegexp })}
                    title={localize('regexDescription')}
                    onClick={(e) => updateUIState({ isUseRegexp: !UIState.isUseRegexp }, e)}
                  ></span>,
                  ]}
                />
              </div>
              {/* <div className='search-notification '>
              <div>This is only a subset of all results. Use a more specific search term to narrow down the result list.</div>
            </div> */}
            </div>
          </div>
        </div>

        <div className={styles.search_and_replace_container}>
          <div className={styles.search_and_replace_fields}>
            <div className={styles.replace_field}>
              <Input
                value={searchBrowserService.replaceValue}
                id='replace-input-field'
                title={localize('search.replace.label')}
                type='text'
                placeholder={localize('search.replace.title')}
                onKeyUp={searchBrowserService.search}
                onChange={searchBrowserService.onReplaceInputChange}
                ref={searchBrowserService.replaceInputEl}
              />
              <div className={`${styles['replace-all-button_container']} ${resultTotal.resultNum > 0 ? '' : styles.disabled}`} onClick={doReplaceAll}>
                <span>
                  {localize('search.replaceAll.label')}
                </span>
              </div>
            </div>
          </div>
        </div>

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
                      content={getIncludeRuleContent()}
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
                      insertClass={cls(styles.checkbox)}
                      label={localize('search.excludes.default.enable')}
                      checked={!UIState.isIncludeIgnored}
                      id='search-input-isIncludeIgnored'
                      onChange={() => { updateUIState({ isIncludeIgnored: !UIState.isIncludeIgnored }); }}
                    />
                    <Popover
                      title={localize('search.help.excludeList')}
                      insertClass={cls(styles.search_excludes_description)}
                      id={'search_excludes'}
                      action={localize('search.help.modify')}
                      onClickAction={searchBrowserService.openPreference}
                      content={getExcludeRuleContent(searchBrowserService.getPreferenceSearchExcludes())}
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
});
