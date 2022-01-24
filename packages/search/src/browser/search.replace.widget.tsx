import React, { RefObject } from 'react';
import { observer } from 'mobx-react-lite';
import { localize } from '@opensumi/ide-core-common/lib/localize';
import { Input } from '@opensumi/ide-components';
import styles from './search.module.less';

interface SearchReplaceWidgetProps {
  replaceValue: string;
  onSearch(): void;
  onReplaceRuleChange(e: React.FormEvent<HTMLInputElement>): void;
  replaceInputEl: RefObject<HTMLInputElement>;
  doReplaceAll(): void;
  resultTotal: {
    resultNum: number;
    fileNum: number;
  };
}

export const SearchReplaceWidget = React.memo(
  observer(
    ({
      replaceValue,
      resultTotal = { resultNum: 0, fileNum: 0 },
      onSearch,
      onReplaceRuleChange,
      replaceInputEl,
      doReplaceAll,
    }: SearchReplaceWidgetProps) => (
      <div className={styles.search_and_replace_container}>
        <div className={styles.search_and_replace_fields}>
          <div className={styles.replace_field}>
            <Input
              value={replaceValue}
              id='replace-input-field'
              title={localize('search.replace.label')}
              type='text'
              placeholder={localize('search.replace.title')}
              onKeyUp={onSearch}
              onChange={onReplaceRuleChange}
              ref={replaceInputEl}
            />
            <div
              className={`${styles.replace_all_button} ${resultTotal.resultNum > 0 ? '' : styles.disabled}`}
              onClick={doReplaceAll}
            >
              <span>{localize('search.replaceAll.label')}</span>
            </div>
          </div>
        </div>
      </div>
    ),
  ),
);
