import React, { useMemo } from 'react';

import { Icon, Popover } from '@opensumi/ide-core-browser/lib/components';

import * as styles from './components.module.less';
import { getExternalIcon, uuid } from '@opensumi/ide-core-browser';
import { LineVertical } from './lineVertical';

export const ChatMoreActions = ({ children }) => {

  const useUUID = useMemo(() => uuid(12), []);

  return (
    <div className={styles.ai_chat_more_actions_container}>
      <div className={styles.ai_chat_message}>{children}</div>
      <div className={styles.more_actions}>
        <div className={styles.side}>
          <Icon className={getExternalIcon('history')} />
          <span>重新生成</span>
        </div>
        <div className={styles.side}>
          <Popover id={`ai-chat-thumbsup-${useUUID}`} title='赞'>
            <Icon className={getExternalIcon('thumbsup')} />
          </Popover>
          <LineVertical />
          <Popover id={`ai-chat-thumbsdown-${useUUID}`} title='踩'>
            <Icon className={getExternalIcon('thumbsdown')} />
          </Popover>
        </div>
      </div>
    </div>
  )
};
