import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { DebugThreadsService } from './debug-threads.service';
import { useInjectable } from '@ali/ide-core-browser';
import * as styles from './debug-threads.module.less';

export const DebugThreadView = observer(() => {
  const {
    currentThread,
  }: DebugThreadsService = useInjectable(DebugThreadsService);
  const renderThreads = (currentThread) => {
    if (currentThread) {
      return <div className={styles.debug_threads_item}>
        <div className={styles.debug_threads_item_label}>
          {currentThread.raw && currentThread.raw.name}
        </div>
        <div className={styles.debug_threads_item_description}>
          {currentThread.stoppedDetails && currentThread.stoppedDetails.description}
        </div>
      </div>;
    }
  };

  return <div className={styles.debug_threads}>
    {renderThreads(currentThread)}
  </div>;
});
