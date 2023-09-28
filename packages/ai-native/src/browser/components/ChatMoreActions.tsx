import React, { useEffect, useMemo, useState } from 'react';

import { getExternalIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';

import { AiChatService } from '../ai-chat.service';

import * as styles from './components.module.less';
import { Thumbs } from './Thumbs';

export interface IChatMoreActionsProps {
  children: React.ReactNode;
  sessionId: string;
}

export const ChatMoreActions = (props: IChatMoreActionsProps) => {
  const { children, sessionId } = props;
  const [latestSessionId, setLatestSessionId] = useState<string>();
  const aiChatService = useInjectable<AiChatService>(AiChatService);

  useEffect(() => {
    const dispose = aiChatService.onChangeSessionId((id) => {
      setLatestSessionId(id);
    });
    return () => {
      dispose.dispose();
    };
  }, [sessionId, aiChatService]);

  const canRetry = useMemo(
    () => sessionId === (latestSessionId || aiChatService.latestSessionId),
    [latestSessionId, sessionId],
  );

  return (
    <div className={styles.ai_chat_more_actions_container}>
      <div className={styles.ai_chat_message}>{children}</div>
      <div className={styles.more_actions}>
        <div className={styles.left_side}>
          {/* {canRetry && (
            <div className={styles.side}>
              <Icon className={getExternalIcon('history')} />
              <span>重新生成</span>
            </div>
          )} */}
        </div>
        <div className={styles.side}>
          <Thumbs />
        </div>
      </div>
    </div>
  );
};
