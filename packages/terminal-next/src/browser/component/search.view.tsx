import cls from 'classnames';
import React from 'react';

import { ValidateInput } from '@opensumi/ide-components';
import { getIcon, localize, useInjectable } from '@opensumi/ide-core-browser';

import { ISearchResult, ITerminalSearchService } from '../../common';

import styles from './search.module.less';

export const TerminalSearch: React.FC<{}> = React.memo((props) => {
  const searchService = useInjectable<ITerminalSearchService>(ITerminalSearchService);
  const [UIState, setUIState] = React.useState(searchService.UIState);
  const [searchResult, setSearchResult] = React.useState<ISearchResult | null>(null);
  const [inputText, setInputText] = React.useState(searchService.text || '');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const dispose = searchService.onVisibleChange((show) => {
      if (show && inputRef.current) {
        inputRef.current.focus();

        if (inputRef.current.value.length > 0) {
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      }
    });
    return () => dispose.dispose();
  }, [searchService]);

  React.useEffect(() => {
    if (!searchService.onResultChange) {
      return;
    }

    const dispose = searchService.onResultChange((event) => {
      setSearchResult(event);
    });

    return () => dispose.dispose();
  }, [searchService]);

  const searchInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      searchService.text = event.target.value;
      searchService.search();
      setInputText(event.target.value);
    },
    [searchService],
  );

  const searchKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        searchService.search();
      }

      if (event.key === 'Escape') {
        searchService.close();
        searchService.clear();
      }
    },
    [searchService],
  );

  const toggleMatchCase = React.useCallback(() => {
    searchService.updateUIState({ isMatchCase: !UIState.isMatchCase });
    setUIState(searchService.UIState);
  }, [searchService, UIState]);

  const toggleRegex = React.useCallback(() => {
    searchService.updateUIState({ isUseRegexp: !UIState.isUseRegexp });
    setUIState(searchService.UIState);
  }, [searchService, UIState]);

  const toggleWholeWord = React.useCallback(() => {
    searchService.updateUIState({ isWholeWord: !UIState.isWholeWord });
    setUIState(searchService.UIState);
  }, [searchService, UIState]);

  const searchNext = React.useCallback(() => {
    searchService.searchNext();
  }, [searchService]);

  const searchPrev = React.useCallback(() => {
    searchService.searchPrevious();
  }, [searchService]);

  const close = React.useCallback(() => {
    searchService.close();
  }, [searchService]);

  return (
    <div className={styles.terminalSearch}>
      <ValidateInput
        className={styles.searchField}
        autoFocus
        id='search-input-field'
        title={localize('search.input.placeholder')}
        type='text'
        value={inputText}
        placeholder={localize('common.find')}
        onKeyDown={searchKeyDown}
        onChange={searchInput}
        ref={inputRef}
        validateMessage={undefined}
        addonAfter={[
          <span
            key={localize('search.caseDescription')}
            className={cls(getIcon('ab'), styles['match-case'], styles.optionBtn, {
              [styles.select]: UIState.isMatchCase,
            })}
            title={localize('search.caseDescription')}
            onClick={toggleMatchCase}
          ></span>,
          <span
            key={localize('search.wordsDescription')}
            className={cls(getIcon('abl'), styles['whole-word'], styles.optionBtn, {
              [styles.select]: UIState.isWholeWord,
            })}
            title={localize('search.wordsDescription')}
            onClick={toggleWholeWord}
          ></span>,
          <span
            key={localize('search.regexDescription')}
            className={cls(getIcon('regex'), styles['use-regexp'], styles.optionBtn, {
              [styles.select]: UIState.isUseRegexp,
            })}
            title={localize('search.regexDescription')}
            onClick={toggleRegex}
          ></span>,
        ]}
      />
      <div className={styles.searchResult}>
        {searchResult ? `${searchResult.resultIndex + 1}/${searchResult.resultCount}` : '0/0'}
      </div>
      <div className={cls(styles.panelBtn, getIcon('up'))} onClick={searchPrev}></div>
      <div className={cls(styles.panelBtn, getIcon('down'))} onClick={searchNext}></div>
      <div className={cls(styles.panelBtn, getIcon('close'))} onClick={close}></div>
    </div>
  );
});
