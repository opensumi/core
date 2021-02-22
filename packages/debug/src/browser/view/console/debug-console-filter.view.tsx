import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize } from '@ali/ide-core-browser';
import * as styles from './debug-console.module.less';
import debounce = require('lodash.debounce');
import { Input } from '@ali/ide-components';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugConsoleFilterService } from './debug-console-filter.service';

/**
 * 调试控制台筛选器
 */
export const DebugConsoleFilterView = observer(() => {
  const debugConsoleFilterService = useInjectable<DebugConsoleFilterService>(DebugConsoleFilterService);
  const [filterValue, setFilterValue] = React.useState<string>('');

  const onDebounceValueChange = debounce((value: string) => {
    setFilterValue(value);
    debugConsoleFilterService.setFilterText(value);
  }, 300);

  React.useEffect(() => {
    const filterDispose = debugConsoleFilterService.onDidValueChange((value: string) => {
      setFilterValue(value);
    });
    return () => {
      filterDispose.dispose();
    };
  }, []);

  return (
    <div className={styles.debug_console_filter}>
      <Input hasClear className={styles.filter_input} value={filterValue} placeholder={localize('debug.console.filter.placeholder')} onValueChange={onDebounceValueChange} />
    </div>
  );
});
