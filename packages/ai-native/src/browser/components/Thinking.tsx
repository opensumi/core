import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AiChatService } from '../ai-chat.service';
import { STOP_IMMEDIATELY } from '../common-reponse';
import { MsgStreamManager, EMsgStreamStatus } from '../model/msg-stream-manager';

import * as styles from './components.module.less';
import { EnhanceIcon } from './Icon';

interface ITinkingProps {
  children?: React.ReactNode;
  status?: EMsgStreamStatus;
  message?: string;
  onRegenerate?: () => void;
  sessionId?: string;
  onStop?: () => void;
}

export const Thinking = ({ children, status, message, onStop }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  const handlePause = useCallback(async () => {
    aiChatService.cancelChatViewToken();
    const { currentSessionId } = msgStreamManager;
    if (currentSessionId) {
      await aiChatService.destroyStreamRequest(currentSessionId);
    }
    onStop && onStop();
  }, [msgStreamManager]);

  const renderContent = useCallback(() => {
    if (status === EMsgStreamStatus.THINKING && !message?.trim()) {
      return <span>Thinking...</span>;
    }

    return children;
  }, [status, message, children]);

  return (
    <div className={styles.thinking_container}>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.stop}>
        <span className={styles.progress_bar}>
          {/* 保持动画效果一致 */}
          {status && (
            <Progress
              loading={true}
              wrapperClassName={`ai-native-progress-wrapper ${
                status === EMsgStreamStatus.DONE || status === EMsgStreamStatus.ERROR
                  ? 'ai-native-progress-wrapper-stop'
                  : ''
              }`}
            />
          )}
        </span>
        <div className={styles.block} onClick={handlePause}>
          <Icon className={getIcon('circle-pause')}></Icon>
          <span>停止</span>
        </div>
      </div>
    </div>
  );
};

export const ThinkingResult = ({ children, message, status, onRegenerate, sessionId }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const [latestSessionId, setLatestSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const dispose = aiChatService.onChangeSessionId((sid) => {
      setLatestSessionId(sid);
    });

    return () => dispose.dispose();
  }, [aiChatService]);

  const handleRegenerate = useCallback(() => {
    if (onRegenerate) {
      onRegenerate();
    }
  }, [onRegenerate]);

  const renderContent = useCallback(() => {
    if ((status === EMsgStreamStatus.DONE || status === EMsgStreamStatus.READY) && !message?.trim()) {
      return <span>{STOP_IMMEDIATELY}</span>;
    }

    return children;
  }, [status, message, children]);

  const isRenderRegenerate = useMemo(() => aiChatService.latestSessionId === sessionId, [sessionId, latestSessionId]);

  return (
    <div className={styles.thinking_container}>
      <div className={styles.content}>{renderContent()}</div>
      {isRenderRegenerate ? (
        <div className={styles.bottom_container}>
          <div className={styles.reset}>
            <EnhanceIcon icon={'refresh'} className={styles.transform} onClick={handleRegenerate}>
              <span>重新生成</span>
            </EnhanceIcon>
          </div>
          <div className={styles.thumbs}>{/* <Thumbs /> */}</div>
        </div>
      ) : null}
    </div>
  );
};
