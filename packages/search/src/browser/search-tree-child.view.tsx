import * as React from 'react';
import { URI, ConfigContext } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import * as cls from 'classnames';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';
import * as styles from './search.module.less';

export const SearchTreeChild =  (
  {
    list,
  }: {
    list: ContentSearchResult[],
  },
) => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const labelService = injector.get(LabelService);
  const uri = URI.file(list[0].fileUri);
  const icon = `file-icon ${labelService.getIcon(uri)}`;

  return (
    <div className={styles.tree_child}>
      <div className={styles.title}>
        <span className={cls('fa', 'fa-caret-down')}></span>
        <span className={cls(icon, styles.icon)}></span><span>{uri.displayName}</span>
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
