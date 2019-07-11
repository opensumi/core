import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Key, ConfigContext } from '@ali/ide-core-browser';
import * as styles from './search.module.less';
import { ISearchInWorkspaceServer, SearchInWorkspaceServerPath } from '../common/';
import { SearchContribution } from './search-contribution';

export const Search = observer(() => {
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const searchInWorkspaceServer: ISearchInWorkspaceServer  = injector.get(SearchInWorkspaceServerPath);
  const searchContribution = injector.get(SearchContribution);

  function search(e: React.KeyboardEvent) {
    const value = (e.target as HTMLInputElement).value;
    if (!e.target || Key.ENTER.keyCode !== e.keyCode) {
      return;
    }

    searchInWorkspaceServer.search(value, [workspaceDir]);
  }

  searchContribution.onResult((data) => {
    console.log('data', data);
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span>SEARCH</span>
      </div>
      <div className={styles['search-and-replace-container']}>
        <div title='Toggle Replace' className={styles['replace-toggle']} >
          <span className='fa fa-caret-down'></span>
        </div>
        <div className={styles['search-and-replace-fields']}>
          <div className={styles['search-field-container']}>
            <div className={styles['search-field']}>
              <input id='search-input-field' title='Search' type='text' placeholder='Search' />
              <div className={styles['option-buttons']}>
                <span className={`${styles['match-case']} ${styles.option}`} title='Match Case'></span>
                <span className={`${styles['whole-word']} ${styles.option}`} title='Match Whole Word'></span>
                <span className={`${styles['use-regexp']} ${styles.option}`} title='Use Regular Expression'></span>
                <span className={`${styles['include-ignored']} ${styles.option} fa fa-eye`} title='Include Ignored Files'></span>
              </div>
            </div>
            {/* <div className='search-notification '>
              <div>This is only a subset of all results. Use a more specific search term to narrow down the result list.</div>
            </div> */}
            </div>
          <div className={styles['replace-field']}>
            <input id='replace-input-field' title='Replace' type='text' placeholder='Replace' />
            <div className={styles['replace-all-button-container']}>
              <span title='Replace All' className={`${styles['replace-all-button']} ${styles.disabled}`}></span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});
