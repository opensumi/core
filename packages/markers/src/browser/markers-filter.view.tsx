import debounce = require('lodash.debounce');
import { observer } from 'mobx-react-lite';
import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { useDisposable } from '@opensumi/ide-core-browser/lib/utils/react-hooks';
import { AutoFocusedInput } from '@opensumi/ide-main-layout/lib/browser/input';

import { IMarkerService, MARKER_CONTAINER_ID } from '../common';

import { FilterOptions } from './markers-filter.model';
import styles from './markers-filter.module.less';
import { MarkerService } from './markers-service';
import Messages from './messages';


/**
 * Marker过滤面板
 */
export const MarkerFilterPanel = observer(() => {
  const markerService: MarkerService = useInjectable(IMarkerService);

  const [filterValue, setFilterValue] = React.useState<string>('');

  useDisposable(() => [
    markerService.onMarkerFilterChanged((opt) => {
      if (opt === undefined) {
        setFilterValue('');
      }
    }),
  ]);

  const onChangeCallback = debounce((value) => {
    setFilterValue(value);
    markerService.fireFilterChanged(value ? new FilterOptions(value) : undefined);
  }, 250);

  return (
    <div className={styles.markerFilterContent}>
      <AutoFocusedInput
        containerId={MARKER_CONTAINER_ID}
        hasClear
        className={styles.filterInput}
        placeholder={Messages.markerPanelFilterInputPlaceholder()}
        value={filterValue}
        onValueChange={onChangeCallback}
      />
    </div>
  );
});
