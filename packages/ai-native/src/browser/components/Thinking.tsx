import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon, Thumbs } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { IAIReporter, localize } from '@opensumi/ide-core-common';

import { ChatService } from '../chat/chat.service';
import { EMsgStreamStatus, MsgStreamManager } from '../model/msg-stream-manager';

import styles from './components.module.less';

interface ITinkingProps {
  children?: React.ReactNode;
  status?: EMsgStreamStatus;
  hasMessage?: boolean;
  message?: string;
  regenerateDisabled?: boolean;
  onRegenerate?: () => void;
  sessionId?: string;
  onStop?: () => void;
  hasAgent?: boolean;
}

export const Thinking = ({ children, status, message, onStop, hasAgent, hasMessage }: ITinkingProps) => {
  const aiChatService = useInjectable<ChatService>(ChatService);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  const handlePause = useCallback(async () => {
    // agent 处理有另外的流程
    if (!hasAgent) {
      aiChatService.cancelChatViewToken();
      const { currentSessionId } = msgStreamManager;
      if (currentSessionId) {
        await aiChatService.destroyStreamRequest(currentSessionId);
      }
    }
    onStop && onStop();
  }, [msgStreamManager]);

  const renderContent = useCallback(() => {
    if (!children || (status === EMsgStreamStatus.THINKING && !message?.trim())) {
      return <span className={styles.thinking_text}>Thinking...</span>;
    }

    return children;
  }, [status, message, children]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.stop}>
          <span className={styles.progress_bar}>
            {/* 保持动画效果一致 */}
            {(!!status || !children) && (
              <Progress loading={true} wrapperClassName={styles.ai_native_progress_wrapper} />
            )}
          </span>
          <div className={styles.block} onClick={handlePause}>
            <Icon className={getIcon('circle-pause')}></Icon>
            <span>{localize('aiNative.operate.stop.title')}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export const ThinkingResult = ({
  children,
  message,
  status,
  onRegenerate,
  sessionId,
  hasMessage,
  regenerateDisabled,
}: ITinkingProps) => {
  const aiChatService = useInjectable<ChatService>(ChatService);
  const aiReporter = useInjectable<IAIReporter>(IAIReporter);
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
    if (
      (status === EMsgStreamStatus.DONE || status === EMsgStreamStatus.READY) && typeof hasMessage === 'boolean'
        ? !hasMessage
        : !message?.trim()
    ) {
      return <span>{localize('aiNative.chat.stop.immediately')}</span>;
    }

    return children;
  }, [status, message, children]);

  const isRenderRegenerate = useMemo(() => aiChatService.latestSessionId === sessionId, [sessionId, latestSessionId]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.bottom_container}>
          <div className={styles.reset}>
            {isRenderRegenerate && !regenerateDisabled ? (
              <EnhanceIcon
                icon={'refresh'}
                wrapperClassName={styles.text_btn}
                className={styles.transform}
                onClick={handleRegenerate}
              >
                <span>{localize('aiNative.operate.afresh.title')}</span>
              </EnhanceIcon>
            ) : null}
          </div>
          <div className={styles.thumbs}>
            <Thumbs relationId={sessionId} wrapperClassName={styles.icon_btn} />
          </div>
        </div>
      </div>
    </>
  );
};
