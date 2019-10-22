import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, localize } from '@ali/ide-core-browser';
import { Input, CheckBox, Popover, PopoverTriggerType } from '@ali/ide-core-browser/lib/components';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { ViewState } from '@ali/ide-activity-panel';
import {
  IEditorDocumentModelService,
} from '@ali/ide-editor/lib/browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import * as cls from 'classnames';
import * as styles from './search.module.less';
import {
  SEARCH_STATE,
  ResultTotal,
} from '../common/';
import { ContentSearchClientService } from './search.service';
import { SearchTree } from './search-tree.view';
import { replaceAll } from './replace';

const MIN_WIDTH = 220;

function getIncludeRuleContent() {
  return (
    <div className={cls(styles.include_rule_content)}>
      <p>{localize('search.help.supportRule')}</p>
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

function getExcludeRuleContent(excludeList: string[], openPreference) {
  return (
    <div className={cls(styles.exclude_rule_content)}>
      <p>
        {localize('search.help.excludeList')}
        <span onClick={openPreference}>
          {localize('search.help.modify')}
        </span>
      </p>
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
}: React.PropsWithChildren<{viewState: ViewState}>,
) => {
  const searchOptionRef = React.createRef<HTMLDivElement>();
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const searchBrowserService = injector.get(ContentSearchClientService);
  const documentModelManager = injector.get(IEditorDocumentModelService);
  const dialogService: IDialogService = injector.get(IDialogService);
  const messageService: IMessageService = injector.get(IMessageService);

  const [searchPanelLayout, setSearchPanelLayout] = React.useState({height: 0, width: 0});
  const searchTreeRef = React.useRef();

  const searchResults = searchBrowserService.searchResults;
  const resultTotal = searchBrowserService.resultTotal;
  const searchState = searchBrowserService.searchState;
  const searchValue = searchBrowserService.searchValue;
  const replaceValue = searchBrowserService.replaceValue;
  const updateUIState = searchBrowserService.updateUIState;
  const UIState = searchBrowserService.UIState;

  function doReplaceAll() {
    if (UIState.isReplaceDoing) {
      return;
    }
    updateUIState({ isReplaceDoing: true });
    replaceAll(
      documentModelManager,
      searchResults!,
      (searchBrowserService.replaceInputEl && searchBrowserService.replaceInputEl.current && searchBrowserService.replaceInputEl.current.value)  || '',
      dialogService,
      messageService,
      resultTotal,
    ).then((isDone) => {
      updateUIState({ isReplaceDoing: false });
      if (!isDone) {
        return;
      }
      searchBrowserService.search();
    });
  }

  React.useEffect(() => {
    setSearchPanelLayout({
      width: searchOptionRef.current && searchOptionRef.current.clientWidth || 0,
      height: searchOptionRef.current && searchOptionRef.current.clientHeight || 0,
    });
  }, [UIState]);

  const collapsePanelContainerStyle = {
    width: viewState.width < MIN_WIDTH ? MIN_WIDTH : viewState.width,
    height: viewState.height,
  };

  return (
    <div className={styles.wrap} style={collapsePanelContainerStyle}>
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
                <Input
                  id='search-input-field'
                  title={localize('search.input.placeholder')}
                  autoFocus
                  type='text'
                  value={searchBrowserService.searchValue}
                  placeholder={localize('search.input.placeholder')}
                  onFocus={() => updateUIState({ isSearchFocus: true })}
                  onBlur={() => updateUIState({ isSearchFocus: false })}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchInputChange}
                  ref={searchBrowserService.searchInputEl}
                />
                <div className={styles.option_buttons}>
                  <span
                    className={cls(getIcon('ab'), styles['match-case'], styles.option, { [styles.select]: UIState.isMatchCase })}
                    title={localize('caseDescription')}
                    onClick={(e) => updateUIState({ isMatchCase: !UIState.isMatchCase }, e)}
                  ></span>
                  <span
                    className={cls(getIcon('abl'), styles['whole-word'], styles.option, { [styles.select]: UIState.isWholeWord })}
                    title={localize('wordsDescription')}
                    onClick={(e) => updateUIState({ isWholeWord: !UIState.isWholeWord }, e)}
                  ></span>
                  <span
                    className={cls(getIcon('regex'), styles['use-regexp'], styles.option, { [styles.select]: UIState.isUseRegexp })}
                    title={localize('regexDescription')}
                    onClick={(e) => updateUIState({ isUseRegexp: !UIState.isUseRegexp }, e)}
                  ></span>
                </div>
              </div>
              {/* <div className='search-notification '>
              <div>This is only a subset of all results. Use a more specific search term to narrow down the result list.</div>
            </div> */}
            </div>
          </div>
        </div>

        <div className={cls(styles.search_details)}>
          {UIState.isDetailOpen ?
            <div className='glob_field-container'>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}>
                  {localize('search.includes')}
                  <span className={cls(styles.include_rule)}>
                    <Popover
                      id={'show_include_rule'}
                      content={getIncludeRuleContent()}
                      trigger={PopoverTriggerType.hover}
                    >
                      {localize('search.help.showIncludeRule')}
                    </Popover>
                  </span>
                </div>
                <Input
                  type='text'
                  placeholder={localize('search.includes.description')}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchIncludeChange}
                />
              </div>
              <div className={cls(styles.glob_field, styles.search_excludes)}>
                <div className={cls(styles.label)}>
                  {localize('search.excludes')}
                  <Popover
                      insertClass={cls(styles.search_excludes_description)}
                      id={'search_excludes'}
                      content={getExcludeRuleContent(searchBrowserService.getPreferenceSearchExcludes(), searchBrowserService.openPreference)}
                      trigger={PopoverTriggerType.hover}
                    >
                    <span className={cls(getIcon('question-circle'))}></span>
                  </Popover>
                  <CheckBox
                    insertClass={cls(styles.checkbox)}
                    label={localize('search.excludes.default.enable')}
                    checked={!UIState.isIncludeIgnored}
                    id='search-input-isIncludeIgnored'
                    onChange={() => { updateUIState({ isIncludeIgnored: !UIState.isIncludeIgnored }); }}
                  />
                </div>
                <Input
                  type='text'
                  placeholder={localize('search.includes.description')}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchExcludeChange}
                />
              </div>
            </div> : ''
          }
        </div>

        <div className={styles.search_and_replace_container}>
          <div className={styles.search_and_replace_fields}>
            <p className={styles.search_input_title}>
              {localize('search.replace.title')}
              <span
                className={styles.replace_all}
                onClick={doReplaceAll}
              >
                {resultTotal.resultNum > 0 ? localize('search.replaceAll.label') : ''}
              </span>
            </p>
            <div className={styles.replace_field}>
              <Input
                id='replace-input-field'
                title={localize('search.replace.label')}
                type='text'
                placeholder={localize('search.replace.label')}
                onKeyUp={searchBrowserService.search}
                onChange={searchBrowserService.onReplaceInputChange}
                ref={searchBrowserService.replaceInputEl}
              />
              <div className={styles['replace-all-button_container']}>
                <span title={localize('replaceAll.confirmation.title')} className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
              </div>
            </div>
          </div>
        </div>

      </div>
      {
        (searchResults && searchResults.size > 0) ? <SearchTree
          searchPanelLayout = {searchPanelLayout}
          viewState={viewState}
          ref={searchTreeRef}
        /> : <div className={cls(searchState === SEARCH_STATE.done ? styles.result_describe : '')}>
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
