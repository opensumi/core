import React, { useCallback, useMemo } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon, Thumbs } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { ChatRenderRegistryToken, isUndefined, localize } from '@opensumi/ide-core-common';

import { IAIChatService } from '../../common/index';
import { ChatRenderRegistry } from '../chat/chat.render.registry';
import { ChatService } from '../chat/chat.service';
import { EMsgStreamStatus, MsgStreamManager } from '../model/msg-stream-manager';

import styles from './components.module.less';

interface ITinkingProps {
  children?: React.ReactNode;
  status?: EMsgStreamStatus;
  hasMessage?: boolean;
  message?: string;
  onRegenerate?: () => void;
  sessionId?: string;
  onStop?: () => void;
  thinkingText?: string;
  showStop?: boolean;
  showRegenerate?: boolean;
  hasAgent?: boolean;
}

export const ChatThinking = (props: ITinkingProps) => {
  const {
    children,
    status = EMsgStreamStatus.THINKING,
    message,
    onStop,
    showStop = true,
    hasAgent,
    thinkingText,
  } = props;

  const aiChatService = useInjectable<ChatService>(IAIChatService);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  const CustomThinkingRender = useMemo(
    () => chatRenderRegistry.chatThinkingRender,
    [chatRenderRegistry, chatRenderRegistry.chatThinkingRender],
  );

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
      if (CustomThinkingRender) {
        return <CustomThinkingRender thinkingText={thinkingText} />;
      }

      return <span className={styles.thinking_text}>{thinkingText || 'Thinking...'}</span>;
    }

    return children;
  }, [status, message, children, thinkingText, CustomThinkingRender]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.stop}>
          {!CustomThinkingRender && (
            <span className={styles.progress_bar}>
              {/* 保持动画效果一致 */}
              {(!!status || !children) && (
                <Progress loading={true} wrapperClassName={styles.ai_native_progress_wrapper} />
              )}
            </span>
          )}
          {showStop && (
            <div className={styles.block} onClick={handlePause}>
              <Icon className={getIcon('circle-pause')}></Icon>
              <span>{localize('aiNative.operate.stop.title')}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export const ChatThinkingResult = ({
  children,
  message,
  status = EMsgStreamStatus.DONE,
  onRegenerate,
  sessionId,
  hasMessage = true,
  showRegenerate,
}: ITinkingProps) => {
  const aiChatService = useInjectable<ChatService>(IAIChatService);

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

  const isRenderRegenerate = useMemo(() => {
    if (isUndefined(showRegenerate)) {
      return aiChatService.latestSessionId === sessionId;
    }

    return !!showRegenerate;
  }, [aiChatService.latestSessionId, sessionId, showRegenerate]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.bottom_container}>
          <div className={styles.reset}>
            {isRenderRegenerate ? (
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
