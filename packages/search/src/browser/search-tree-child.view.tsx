import * as React from 'react';
import { URI, ConfigContext } from '@ali/ide-core-browser';
import * as styles from './search.module.less';
import * as cls from 'classnames';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';

export const SearchTreeChild = (
  {
    list,
  }: {
    list: ContentSearchResult[],
  },
) => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const uri = URI.file(list[0].fileUri);

  return (
    <div className={styles['tree-child']}>
      <div className={styles.title}>
        <span className={cls('fa', 'fa-caret-down')}></span>
        <span>ICON</span><span>{uri.displayName}</span>
      </div>
      <ul className={styles.result}>
        {list.map((result) => {
          return (<li key={`${result.line}_${result.matchStart}`}>
            <span>{result.lineText}</span>
          </li>);
        })}
      </ul>
    </div>
  );
};
