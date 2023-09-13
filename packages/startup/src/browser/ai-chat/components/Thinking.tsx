import React, { useState } from 'react';

import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import * as styles from './components.module.less';

export const Thinking = () => (
  <div className={styles.thinking_container}>
    <div className={styles.content}>
      <span>Thinking...</span>
    </div>
    <div className={styles.stop}>
      <span className={styles.progress_bar}>
        <Progress loading={true} className={styles.bar} />
      </span>
      <div className={styles.block}>
        <Icon className={getIcon('pause')}></Icon>
        <span>停止</span>
      </div>
    </div>
  </div>
);
