import React, { useCallback } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AiSumiService } from '../ai-sumi/sumi.service';

import * as styles from './components.module.less';

export const Thinking = () => {
  const aiSumiService = useInjectable<AiSumiService>(AiSumiService);

  const handlePause = useCallback(() => {
    aiSumiService.cancelAll();
  }, []);

  return (
    <div className={styles.thinking_container}>
      <div className={styles.content}>
        <span>Thinking...</span>
      </div>
      <div className={styles.stop}>
        <span className={styles.progress_bar}>
          <Progress loading={true} />
        </span>
        <div className={styles.block} onClick={handlePause}>
          <Icon className={getIcon('pause')}></Icon>
          <span>停止</span>
        </div>
      </div>
    </div>
  );
};
