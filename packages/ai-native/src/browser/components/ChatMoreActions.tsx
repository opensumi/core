import React, { useEffect, useMemo, useState } from 'react';

import { getExternalIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';

import { AiChatService } from '../ai-chat.service';
import { MsgStreamManager } from '../model/msg-stream-manager';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';
import { Thumbs } from './Thumbs';

export interface IChatMoreActionsProps {
  children: React.ReactNode;
  sessionId: string;
}

export const ChatMoreActions = (props: IChatMoreActionsProps) => {
  const { children, sessionId } = props;
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  const canRetry = useMemo(() => sessionId === msgStreamManager.currentSessionId, [sessionId]);

  return (
    <div className={styles.ai_chat_more_actions_container}>
      <div className={styles.ai_chat_message}>{children}</div>
      <div className={styles.chat_msg_more_actions}>
        <div className={styles.left_side}>
          {canRetry && (
            <div className={styles.side}>
              <EnhanceIcon className={getExternalIcon('refresh')}>
                <span style={{ marginLeft: 5, fontSize: 12 }}>重新生成</span>
              </EnhanceIcon>
            </div>
          )}
        </div>
        {/* <div className={styles.side}><Thumbs /></div> */}
      </div>
    </div>
  );
};
