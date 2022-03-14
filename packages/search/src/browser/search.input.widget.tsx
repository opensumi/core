import cls from 'classnames';
import React, { RefObject } from 'react';

import { ValidateInput, CheckBox, ValidateMessage } from '@opensumi/ide-components';
import { getIcon } from '@opensumi/ide-core-browser/lib/style/icon/icon';
import { localize } from '@opensumi/ide-core-common/lib/localize';

import styles from './search.module.less';

export interface SearchInputWidgetProps {
  isDetailOpen: boolean;
  onDetailToggle: () => void;
  isSearchFocus: boolean;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  isMatchCase: boolean;
  onMatchCaseToggle: () => void;
  isWholeWord: boolean;
  onWholeWordToggle: () => void;
  isRegex: boolean;
  onRegexToggle: () => void;
  searchValue: string;
  onSearch: () => void;
  onSearchInputChange: (e: React.FormEvent<HTMLInputElement>) => void;
  searchInputEl: RefObject<HTMLInputElement>;
  isShowValidateMessage: boolean;
  validateMessage?: ValidateMessage;
}

const SearchRuleCheckout = React.memo(
  ({ isDetailOpen, onDetailToggle }: Pick<SearchInputWidgetProps, 'isDetailOpen' | 'onDetailToggle'>) => (
    <p className={styles.search_input_title}>
      {localize('search.input.title')}
      <CheckBox
        className={cls(styles.checkbox)}
        label={localize('search.input.checkbox')}
        checked={isDetailOpen}
        id='search-input'
        onChange={onDetailToggle}
      />
    </p>
  ),
  (prevProps, nextProps) => prevProps.isDetailOpen === nextProps.isDetailOpen,
);

function isSearchInputPropsEqual(prevProps: SearchInputWidgetProps, nextProps: SearchInputWidgetProps) {
  return (
    prevProps.isDetailOpen === nextProps.isDetailOpen &&
    prevProps.isSearchFocus === nextProps.isSearchFocus &&
    prevProps.isMatchCase === nextProps.isMatchCase &&
    prevProps.isWholeWord === nextProps.isWholeWord &&
    prevProps.isRegex === nextProps.isRegex &&
    prevProps.searchValue === nextProps.searchValue &&
    prevProps.isShowValidateMessage === nextProps.isShowValidateMessage &&
    prevProps.validateMessage === nextProps.validateMessage
  );
}

export const SearchInputWidget = React.memo(
  ({
    isDetailOpen,
    onDetailToggle,
    isSearchFocus,
    onSearchFocus,
    onSearchBlur,
    isMatchCase,
    onMatchCaseToggle,
    isWholeWord,
    onWholeWordToggle,
    isRegex,
    onRegexToggle,
    searchValue,
    onSearch,
    onSearchInputChange,
    searchInputEl,
    isShowValidateMessage,
    validateMessage,
  }: SearchInputWidgetProps) => (
    <div className={styles.search_and_replace_container}>
      <div className={styles.search_and_replace_fields}>
        <div className={styles.search_field_container}>
          <SearchRuleCheckout isDetailOpen={isDetailOpen} onDetailToggle={onDetailToggle} />
          <div className={cls(styles.search_field, { [styles.focus]: isSearchFocus })}>
            <ValidateInput
              id='search-input-field'
              title={localize('search.input.placeholder')}
              type='text'
              value={searchValue}
              placeholder={localize('search.input.title')}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              onKeyUp={onSearch}
              onChange={onSearchInputChange}
              ref={searchInputEl}
              validateMessage={isShowValidateMessage ? validateMessage : undefined}
              addonAfter={[
                <span
                  key={localize('caseDescription')}
                  className={cls(getIcon('ab'), styles['match-case'], styles.search_option, {
                    [styles.select]: isMatchCase,
                  })}
                  title={localize('caseDescription')}
                  onClick={onMatchCaseToggle}
                ></span>,
                <span
                  key={localize('wordsDescription')}
                  className={cls(getIcon('abl'), styles['whole-word'], styles.search_option, {
                    [styles.select]: isWholeWord,
                  })}
                  title={localize('wordsDescription')}
                  onClick={onWholeWordToggle}
                ></span>,
                <span
                  key={localize('regexDescription')}
                  className={cls(getIcon('regex'), styles['use-regexp'], styles.search_option, {
                    [styles.select]: isRegex,
                  })}
                  title={localize('regexDescription')}
                  onClick={onRegexToggle}
                ></span>,
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  ),
  isSearchInputPropsEqual,
);
