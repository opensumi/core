import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { FilterOptions } from './markers-filter.model';
import * as styles from './markers-filter.module.less';
import { MarkerService } from './markers-service';
import Messages from './messages';
import debounce = require('lodash.debounce');
import { Input } from '@ali/ide-components';
import { useDisposable } from '@ali/ide-core-browser/src/react-hooks/disposable';

/**
 * Marker过滤面板
 */
export const MarkerFilterPanel = observer(() => {
  const markerService = MarkerService.useInjectable();
  const [filterValue, setFilterValue] = React.useState<string>('');

  useDisposable(() => {
    return [
      markerService.onMarkerFilterChanged((opt) => {
        if (opt === undefined) {
          setFilterValue('');
        }
      }),
    ];
  });

  const onChangeCallback = debounce((value) => {
    setFilterValue(value);
    markerService.fireFilterChanged(value ? new FilterOptions(value) : undefined);
  }, 250);

  return (
    <div className={styles.markerFilterContent}>
      <Input
        hasClear
        className={styles.filterInput}
        placeholder={Messages.markerPanelFilterInputPlaceholder()}
        value={filterValue}
        onValueChange={onChangeCallback} />
    </div>
  );
});
