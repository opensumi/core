import debounce from 'lodash/debounce';
import React from 'react';

import { HistoryInputBox, IHistoryInputBoxHandler } from '@opensumi/ide-components/lib/input/HistoryInputBox';
import { Key, localize, useDesignStyles, useInjectable } from '@opensumi/ide-core-browser';

import { DebugConsoleFilterService } from './debug-console-filter.service';
import styles from './debug-console.module.less';

/**
 * 调试控制台筛选器
 */
export const DebugConsoleFilterView = () => {
  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const [filterValue, setFilterValue] = React.useState<string>('');
  const [historyApi, setHistoryApi] = React.useState<IHistoryInputBoxHandler>();
  const styles_debug_console_filter = useDesignStyles(styles.debug_console_filter, 'debug_console_filter');
  const styles_filter_input = useDesignStyles(styles.filter_input, 'filter_input');

  const onDebounceValueChange = debounce((value: string) => {
    setFilterValue(value);
    debugConsoleFilterService.setFilterText(value);
    if (historyApi) {
      historyApi.addToHistory(value);
    }
  }, 400);

  React.useEffect(() => {
    const filterDispose = debugConsoleFilterService.onDidValueChange((value: string) => {
      setFilterValue(value);
    });
    return () => {
      filterDispose.dispose();
    };
  }, []);

  const onReady = (api: IHistoryInputBoxHandler) => {
    setHistoryApi(api);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!historyApi) {
      return;
    }

    if (e.keyCode === Key.ARROW_UP.keyCode) {
      historyApi.showPreviousValue();
    } else if (e.keyCode === Key.ARROW_DOWN.keyCode) {
      historyApi.showNextValue();
    }
  };

  React.useEffect(() => {
    const focusDispose = debugConsoleFilterService.onDidFocus(() => {
      if (historyApi) {
        historyApi.focus();
      }
    });
    return () => {
      focusDispose.dispose();
    };
  }, [historyApi]);

  return (
    <div className={styles_debug_console_filter}>
      <HistoryInputBox
        hasClear
        className={styles_filter_input}
        value={filterValue}
        placeholder={localize('debug.console.filter.placeholder')}
        onValueChange={onDebounceValueChange}
        onReady={onReady}
        onKeyDown={onKeyDown}
      ></HistoryInputBox>
    </div>
  );
};
