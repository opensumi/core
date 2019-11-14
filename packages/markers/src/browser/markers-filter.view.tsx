import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { FilterOptions } from './markers-filter.model';
import * as styles from './markers-filter.module.less';
import { MarkerService } from './markers-service';
import Messages from './messages';
import debounce = require('lodash.debounce');

/**
 * Marker过滤面板
 */
export const MarkerFilterPanel = observer(() => {
  const ref = React.useRef<HTMLInputElement | null>();
  const markerService = MarkerService.useInjectable();

  React.useEffect(() => {
    markerService.onMarkerFilterChanged((opt) => {
      if (opt === undefined) {
        if (ref.current) {
          ref.current.value = '';
        }
      }
    });
  });

  const onChangeCallback = debounce((value) => {
    if (value) {
      markerService.fireFilterChanged(new FilterOptions(value));
    } else {
      markerService.fireFilterChanged(undefined);
    }
  }, 250);

  return (
    <div className={styles.markerFilterContent}>
      <input className={styles.filterInput}
        ref={(ele) => ref.current = ele}
        placeholder={Messages.markerPanelFilterInputPlaceholder()}
        onChange={(event) => {
          onChangeCallback(event.target.value);
        }} />
    </div>
  );
});
