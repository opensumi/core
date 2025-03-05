import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon, Thumbs } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { ChatRenderRegistryToken, isUndefined, localize } from '@opensumi/ide-core-common';

import { IChatInternalService } from '../../common/index';
import { ChatInternalService } from '../chat/chat.internal.service';
import { ChatRenderRegistry } from '../chat/chat.render.registry';

import styles from './components.module.less';

interface ITinkingProps {
  children?: React.ReactNode;
  hasMessage?: boolean;
  message?: string;
  onRegenerate?: () => void;
  requestId?: string;
  thinkingText?: string;
  showRegenerate?: boolean;
}

export const ChatThinking = (props: ITinkingProps) => {
  const { children, message, thinkingText } = props;

  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);

  const CustomThinkingRender = useMemo(
    () => chatRenderRegistry.chatThinkingRender,
    [chatRenderRegistry, chatRenderRegistry.chatThinkingRender],
  );

  const renderContent = useCallback(() => {
    if (!children || !message?.trim()) {
      if (CustomThinkingRender) {
        return <CustomThinkingRender thinkingText={thinkingText} />;
      }

      return <span className={styles.thinking_text}>{thinkingText || 'Thinking...'}</span>;
    }

    return children;
  }, [message, children, thinkingText, CustomThinkingRender]);

  return (
    <>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.thinking_container}>
        <div className={styles.stop}>
          {!CustomThinkingRender && (
            <span className={styles.progress_bar}>
              {/* 保持动画效果一致 */}
              {!children && <Progress loading={true} wrapperClassName={styles.ai_native_progress_wrapper} />}
            </span>
          )}
          {/* {showStop && (
            <div className={styles.block} onClick={handlePause} tabIndex={0} role='button'>
              <Icon className={getIcon('circle-pause')}></Icon>
              <span>{localize('aiNative.operate.stop.title')}</span>
            </div>
          )} */}
        </div>
      </div>
    </>
  );
};

export const ChatThinkingResult = ({
  children,
  message,
  onRegenerate,
  requestId,
  hasMessage = true,
  showRegenerate,
}: ITinkingProps) => {
  const aiChatService = useInjectable<ChatInternalService>(IChatInternalService);
  const [latestRequestId, setLatestRequestId] = useState(aiChatService.latestRequestId);
  const chatRenderRegistry = useInjectable<ChatRenderRegistry>(ChatRenderRegistryToken);

  useEffect(() => {
    const dispose = aiChatService.onChangeRequestId((id) => {
      setLatestRequestId(id);
    });

    return () => dispose.dispose();
  }, [aiChatService]);

  const CustomThinkingResultRender = useMemo(
    () => chatRenderRegistry.chatThinkingResultRender,
    [chatRenderRegistry, chatRenderRegistry.chatThinkingResultRender],
  );

  const handleRegenerate = useCallback(() => {
    if (onRegenerate) {
      onRegenerate();
    }
  }, [onRegenerate]);

  const renderContent = useCallback(() => {
    if (typeof hasMessage === 'boolean' ? !hasMessage : !message?.trim()) {
      const stopimmediately = localize('aiNative.chat.stop.immediately');
      if (CustomThinkingResultRender) {
        return <CustomThinkingResultRender thinkingResult={stopimmediately} />;
      }
      return <span>{stopimmediately}</span>;
    }

    return children;
  }, [message, hasMessage, children]);

  const isRenderRegenerate = useMemo(() => {
    if (isUndefined(showRegenerate)) {
      return latestRequestId === requestId && !!requestId;
    }

    return !!showRegenerate;
  }, [latestRequestId, requestId, showRegenerate]);

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
                tabIndex={0}
                role='button'
              >
                <span>{localize('aiNative.operate.afresh.title')}</span>
              </EnhanceIcon>
            ) : null}
          </div>
          <div className={styles.thumbs}>
            <Thumbs relationId={requestId} wrapperClassName={styles.icon_btn} />
          </div>
        </div>
      </div>
    </>
  );
};
