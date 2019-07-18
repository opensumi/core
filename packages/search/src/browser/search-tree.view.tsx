import * as React from 'react';
import { URI } from '@ali/ide-core-browser';
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
    searchResults: ContentSearchResult[] | null,
    searchValue: string,
    searchState: SEARCH_STATE,
  },
) => {

  const content = (searchResults || []).map((searchResult: ContentSearchResult, index) => {
    const { fileUri, lineText } = searchResult;
    const uri = URI.file(searchResult.fileUri);
    return (
      <SearchTreeChild
        key={ index }
        list={[searchResult]}
      />
    );
  });

  return (
    <div className={styles.tree}>
       { searchResults && searchResults.length > 1 ?
        <div>
          {content}
        </div> :
        <div>
          { searchResults !== null ? 'No results found.' : '' }
        </div>
       }
    </div>
  );
};
