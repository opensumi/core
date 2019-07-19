import * as React from 'react';
import { URI } from '@ali/ide-core-browser';
import { PerfectScrollbar } from '@ali/ide-core-browser/lib/components/scrollbar';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';
import * as styles from './search.module.less';
import { SearchTreeChild } from './search-tree-child.view';

export const SearchTree = (
  {
    searchResults,
    searchValue,
    searchState,
  }: {
    searchResults: Map<string, ContentSearchResult[]> | null,
    searchValue: string,
    searchState: SEARCH_STATE,
  },
) => {

  const result = Array.from((searchResults || []));
  const content = result.map((searchResultList) => {
    return (
      <SearchTreeChild
        key={searchResultList[0]}
        path={searchResultList[0]}
        list={searchResultList[1]}
      />
    );
  });

  return (
    <div className={styles.tree}>
      {searchResults && result.length > 0 ?
        <PerfectScrollbar>
          {content}
        </PerfectScrollbar> :
        <div className={styles.result_describe}>
          {searchResults !== null ? 'No results found.' : ''}
        </div>
      }
    </div>
  );
};
