import React, { RefObject } from 'react';
import { Input } from '@opensumi/ide-components/lib/input/Input';
import { localize } from '@opensumi/ide-core-common/lib/localize';

import styles from './search.module.less';

interface SearchReplaceWidgetProps {
  replaceValue: string;
  onSearch(): void;
  onReplaceRuleChange(e: React.FormEvent<HTMLInputElement>): void;
  replaceInputEl: RefObject<HTMLInputElement>;
  doReplaceAll(): void;
  resultCount: number;
}

export const SearchReplaceWidget = React.memo(
  ({
    replaceValue,
    onSearch,
    onReplaceRuleChange,
    replaceInputEl,
    doReplaceAll,
    resultCount,
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
            className={`${styles['replace-all-button_container']} ${resultCount > 0 ? '' : styles.disabled}`}
            onClick={doReplaceAll}
          >
            <span>{localize('search.replaceAll.label')}</span>
          </div>
        </div>
      </div>
    </div>
  ),
  (prevProps, nextProps) => prevProps.replaceValue === nextProps.replaceValue,
);
