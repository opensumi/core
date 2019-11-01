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
  const ref = React.useRef<HTMLInputElement | null>();
  const markerService = MarkerService.useInjectable();
  let currentTimer: NodeJS.Timer | undefined;

  React.useEffect(() => {
    markerService.onMarkerFilterChanged((opt) => {
      if (opt === undefined) {
        if (ref.current) {
          ref.current.value = '';
        }
      }
    });

    return () => {// clear timer on stop
      if (currentTimer) {
        clearTimeout(currentTimer);
      }
    };
  }, [currentTimer]);

  return (
    <div className={styles.markerFilterContent}>
      <input className={styles.filterInput}
        ref={(ele) => ref.current = ele}
        placeholder={Messages.MARKERS_PANEL_FILTER_INPUT_PLACEHOLDER}
        onChange={(event) => {
          if (currentTimer) {
            clearTimeout(currentTimer);
          }
          currentTimer = setTimeout((value) => {
            currentTimer = undefined;
            if (value) {
              markerService.fireFilterChanged(new FilterOptions(value));
            } else {
              markerService.fireFilterChanged(undefined);
            }
          }, 250, event.target.value);
        }} />
    </div>
  );
});
