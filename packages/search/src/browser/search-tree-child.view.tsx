import * as React from 'react';
import { URI, ConfigContext } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { WorkbenchEditorService } from '@ali/ide-editor';
import * as cls from 'classnames';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';
import * as styles from './search.module.less';

function open(workbenchEditorService: WorkbenchEditorService, result: ContentSearchResult) {
  return workbenchEditorService.open(
    new URI(result.fileUri),
    {
      range: {
        startLineNumber: result.line - 1,
        startColumn: result.matchStart - 1,
        endLineNumber: result.line - 1,
        endColumn: result.matchStart - 1 + result.matchLength,
      },
    },
  );
}

export const SearchTreeChild =  (
  {
    list,
    path,
  }: {
    list: ContentSearchResult[],
    path: string,
  },
) => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const labelService = injector.get(LabelService);
  const workbenchEditorService = injector.get(WorkbenchEditorService);
  const uri = URI.file(path);
  const icon = `file-icon ${labelService.getIcon(uri)}`;

  return (
    <div className={styles.tree_child}>
      <div className={styles.title}>
        <span className={cls('fa', 'fa-caret-down')}></span>
        <span className={cls(icon, styles.icon)}></span><span>{uri.displayName}</span>
      </div>
      <ul className={styles.result}>
        {list.map((result) => {
          return (
            <li
              key={`${result.line}_${result.matchStart}`}
              onClick={() => { open(workbenchEditorService, result); }}
            >
            <span className={styles.text}>{result.lineText}</span>
          </li>);
        })}
      </ul>
    </div>
  );
};
