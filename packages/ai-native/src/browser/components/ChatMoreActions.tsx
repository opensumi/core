import React from 'react';

import { getExternalIcon } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';
import { Thumbs } from './Thumbs';

export const ChatMoreActions = ({ children }) => (
    <div className={styles.ai_chat_more_actions_container}>
      <div className={styles.ai_chat_message}>{children}</div>
      <div className={styles.more_actions}>
        <div className={styles.side}>
          <Icon className={getExternalIcon('history')} />
          <span>重新生成</span>
        </div>
        <div className={styles.side}>
          <Thumbs />
        </div>
      </div>
    </div>
  );
