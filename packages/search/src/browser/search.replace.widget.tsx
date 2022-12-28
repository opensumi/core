import cls from 'classnames';
import React from 'react';

import { Input } from '@opensumi/ide-components';
import { localize } from '@opensumi/ide-core-common/lib/localize';

import styles from './search.module.less';

interface SearchReplaceWidgetProps {
  replaceValue: string;
  onSearch(): void;
  onReplaceRuleChange(e: React.FormEvent<HTMLInputElement>): void;
  replaceAll(): void;
  disabled: boolean;
}

export const SearchReplaceWidget = React.memo(
  ({ replaceValue, disabled = true, onSearch, onReplaceRuleChange, replaceAll }: SearchReplaceWidgetProps) => (
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
          />
          <div className={cls(styles.replace_all_button, disabled && styles.disabled)} onClick={replaceAll}>
            <span>{localize('search.replaceAll.label')}</span>
          </div>
        </div>
      </div>
    </div>
  ),
);
