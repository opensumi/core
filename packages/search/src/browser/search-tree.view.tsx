import * as React from 'react';
import { URI } from '@ali/ide-core-browser';
import * as styles from './search.module.less';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';

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

  console.log('searchResults', searchResults);

  const content = (searchResults || []).map((searchResult: ContentSearchResult) => {
    const { fileUri, lineText } = searchResult;
    const uri = URI.file(searchResult.fileUri);
    return (
      <div>
        <div><span>{uri.displayName}</span></div>
        <p className={styles['line-text']}><span> {lineText}</span></p>
      </div>
    );
  });

  return (
    <div>
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
