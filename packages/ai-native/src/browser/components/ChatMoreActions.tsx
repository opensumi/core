import React, { useMemo, useState, useEffect } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';

import { IAIReporter } from '../../common';
import { AiChatService } from '../ai-chat.service';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';
import { Thumbs } from './Thumbs';

export interface IChatMoreActionsProps {
  children: React.ReactNode;
  sessionId: string;
  onRetry?: () => void;
}

export const ChatMoreActions = (props: IChatMoreActionsProps) => {
  const { children, sessionId, onRetry } = props;
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);

  const [latestSessionId, setLatestSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const dispose = aiChatService.onChangeSessionId((sid) => {
      setLatestSessionId(sid);
    });

    return () => dispose.dispose();
  }, [aiChatService]);

  const showOperate = useMemo(() => sessionId === aiChatService.latestSessionId, [sessionId, latestSessionId]);

  return (
    <div className={styles.ai_chat_more_actions_container}>
      <div className={styles.ai_chat_message}>{children}</div>
      {
        showOperate ? (
          <div className={styles.bottom_container}>
            <div className={styles.reset}>
              {
                onRetry && (
                  <EnhanceIcon icon={'refresh'} className={styles.transform} onClick={onRetry}>
                    <span>重新生成</span>
                  </EnhanceIcon>
                )
              }
            </div>
            <div className={styles.thumbs}><Thumbs relationId={sessionId} aiReporterService={aiReporter} /></div>
          </div>
        ) : null
      }
    </div>
  );
};
