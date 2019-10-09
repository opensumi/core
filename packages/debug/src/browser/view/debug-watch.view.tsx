import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { DebugWatchService } from './debug-watch.service';
import { useInjectable } from '@ali/ide-core-browser';
import * as styles from './debug-watch.module.less';

export const DebugWatchView = observer(() => {
  const {
  }: DebugWatchService = useInjectable(DebugWatchService);

  return <div className={styles.debug_watch}>
  </div>;
});
