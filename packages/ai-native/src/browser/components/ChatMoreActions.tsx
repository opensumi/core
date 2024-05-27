import React, { useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { EnhanceIcon, Thumbs } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IAIReporter } from '@opensumi/ide-core-common/lib/ai-native/reporter';

import { AiChatService } from '../ai-chat.service';

import styles from './components.module.less';

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
      <div className={styles.bottom_container}>
        <div className={styles.reset}>
          {showOperate && onRetry ? (
            <EnhanceIcon
              icon={'refresh'}
              wrapperClassName={styles.text_btn}
              className={styles.transform}
              onClick={onRetry}
            >
              <span>重新生成</span>
            </EnhanceIcon>
          ) : null}
        </div>
        <div className={styles.thumbs}>
          <Thumbs relationId={sessionId} wrapperClassName={styles.icon_btn} aiReporterService={aiReporter} />
        </div>
      </div>
    </div>
  );
};
