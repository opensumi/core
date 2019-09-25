import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext, localize, URI, Schemas } from '@ali/ide-core-browser';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { ViewState } from '@ali/ide-activity-panel';
import {
  IEditorDocumentModelService,
} from '@ali/ide-editor/lib/browser';
import * as cls from 'classnames';
import * as styles from './search.module.less';
import {
  SEARCH_STATE,
  ResultTotal,
} from '../common/';
import { SearchBrowserService } from './search.service';
import { SearchTree } from './search-tree.view';
import { replaceAll } from './replace';

function getResultTotalContent(total: ResultTotal) {
  if (total.resultNum > 0) {
    return (
      <p className={styles.result_describe}>
        {
          localize('search.files.result', '{0} result in {1} files')
            .replace('{0}', String(total.resultNum))
            .replace('{1}', String(total.fileNum))
        }
      </p>
    );
  }
  return '';
}

export const Search = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>,
) => {
  const searchOptionRef = React.createRef<HTMLDivElement>();
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const searchBrowserService = injector.get(SearchBrowserService);
  const documentModelManager = injector.get(IEditorDocumentModelService);
  const dialogService: IDialogService = injector.get(IDialogService);
  const messageService: IMessageService = injector.get(IMessageService);

  const [searchPanelLayout, setSearchPanelLayout] = React.useState({height: 0, width: 0});
  const searchTreeRef = React.useRef();

  const searchResults = searchBrowserService.searchResults;
  const resultTotal = searchBrowserService.resultTotal;
  const searchState = searchBrowserService.searchState;
  const searchValue = searchBrowserService.searchValue;
  const UIState = searchBrowserService.UIState;

  let isReplaceDoing = false;

  function updateUIState(obj, e?: React.KeyboardEvent | React.MouseEvent) {
    const newUIState = Object.assign({}, UIState, obj);
    searchBrowserService.UIState = newUIState;
    if (!e) { return; }
    searchBrowserService.search(e, newUIState);
  }

  function doReplaceAll() {
    if (isReplaceDoing) {
      return;
    }
    isReplaceDoing = true;
    replaceAll(
      documentModelManager,
      searchResults!,
      (searchBrowserService.replaceInputEl && searchBrowserService.replaceInputEl.value)  || '',
      dialogService,
      messageService,
      resultTotal,
    ).then((isDone) => {
      isReplaceDoing = false;
      if (!isDone) {
        return;
      }
      searchBrowserService.search();
    });
  }

  searchBrowserService.onFold(() => {
    if (searchTreeRef && searchTreeRef.current) {
      (searchTreeRef as any).current.foldTree();
    }
  });

  React.useEffect(() => {
    setSearchPanelLayout({
      width: searchOptionRef.current && searchOptionRef.current.clientWidth || 0,
      height: searchOptionRef.current && searchOptionRef.current.clientHeight || 0,
    });
  }, [UIState]);

  const collapsePanelContainerStyle = {
    width: viewState.width,
    height: viewState.height,
  };

  return (
    <div className={styles.wrap} style={collapsePanelContainerStyle}>
      <div className={styles.search_options} ref={searchOptionRef}>
        <div className={styles.search_and_replace_container}>
          <div
            title={localize('search.replace.toggle.button.title')}
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
                  title={localize('searchView')}
                  autoFocus
                  type='text'
                  value={searchBrowserService.searchValue}
                  placeholder={localize('searchView')}
                  onFocus={() => updateUIState({ isSearchFocus: true })}
                  onBlur={() => updateUIState({ isSearchFocus: false })}
                  onKeyUp={searchBrowserService.search}
                  onChange={searchBrowserService.onSearchInputChange}
                  ref={(el) => { searchBrowserService.searchInputEl = el; }}
                />
                <div className={styles.option_buttons}>
                  <span
                    className={cls('volans_icon ab', styles['match-case'], styles.option, { [styles.select]: UIState.isMatchCase })}
                    title={localize('caseDescription')}
                    onClick={(e) => updateUIState({ isMatchCase: !UIState.isMatchCase }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon abl', styles['whole-word'], styles.option, { [styles.select]: UIState.isWholeWord })}
                    title={localize('wordsDescription')}
                    onClick={(e) => updateUIState({ isWholeWord: !UIState.isWholeWord }, e)}
                  ></span>
                  <span
                    className={cls('volans_icon holomorphy', styles['use-regexp'], styles.option, { [styles.select]: UIState.isUseRegexp })}
                    title={localize('regexDescription')}
                    onClick={(e) => updateUIState({ isUseRegexp: !UIState.isUseRegexp }, e)}
                  ></span>
                  <span
                    className={cls('fa fa-eye', styles['include-ignored'], styles.option, { [styles.select]: UIState.isIncludeIgnored })}
                    title={localize('includeIgnoredFiles')}
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
                title={localize('match.replace.label')}
                type='text'
                placeholder={localize('match.replace.label')}
                onKeyUp={searchBrowserService.search}
                onChange={searchBrowserService.onReplaceInputChange}
                ref={(el) => { searchBrowserService.replaceInputEl = el; }}
              />
              <span
                className={cls('volans_icon swap', styles.replace)}
                title={localize('match.replace.label')}
                onClick={doReplaceAll}
              ></span>
              <div className={styles['replace-all-button_container']}>
                <span title={localize('replaceAll.confirmation.title')} className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
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
                <div className={cls(styles.label)}> {localize('searchScope.includes')}</div>
                <input
                  type='text'
                  onKeyUp={searchBrowserService.search}
                  ref={(el) => searchBrowserService.includeInputEl = el}
                />
              </div>
              <div className={cls(styles.glob_field)}>
                <div className={cls(styles.label)}>{localize('searchScope.excludes')}</div>
                <input
                  type='text'
                  onKeyUp={searchBrowserService.search}
                  ref={(el) => searchBrowserService.excludeInputEl = el}
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
          searchResults={searchBrowserService.searchResults}
          searchValue={searchValue}
          searchState={searchState}
          ref={searchTreeRef}
          replaceValue={searchBrowserService.replaceValue}
          viewState={viewState}
        /> : <div className={styles.result_describe}>
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
