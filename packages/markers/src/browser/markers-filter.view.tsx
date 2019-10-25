import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { FilterOptions } from './markers-filter.model';
import * as styles from './markers-filter.module.less';
import { MarkerService } from './markers-service';
import Messages from './messages';

/**
 * Marker过滤面板
 */
export const MarkerFilterPanel = observer(() => {
  const markerService = MarkerService.useInjectable();
  return (
    <div className={styles.markerFilterContent}>
      <input className={styles.filterInput}
        placeholder={Messages.MARKERS_PANEL_FILTER_INPUT_PLACEHOLDER}
        onChange={(event) => {
          const value = event.target.value;
          if (value) {
            markerService.fireFilterChanged(new FilterOptions(value));
          } else {
            markerService.fireFilterChanged(undefined);
          }
        }} />
    </div>
  );
});
