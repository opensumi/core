import React, { useCallback } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AiChatService } from '../ai-chat.service';
import { MsgStreamManager, EMsgStreamStatus } from '../model/msg-stream-manager';

import * as styles from './components.module.less';

interface ITinkingProps {
  children?: React.ReactNode;
  status?: EMsgStreamStatus;
  message?: string;
}

export const Thinking = ({ children, status, message }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);
  const msgStreamManager = useInjectable<MsgStreamManager>(MsgStreamManager);

  const handlePause = useCallback(async () => {
    aiChatService.cancelChatViewToken();
    const { currentSessionId } = msgStreamManager;
    if (currentSessionId) {
      await aiChatService.destroyStreamRequest(currentSessionId);
    }
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

export const ThinkingResult = ({ children, message, status }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);

  const handleReset = useCallback(() => {
    // aiChatService.launchChatMessage({
    //   message,
    // });
  }, []);

  const renderContent = useCallback(() => {
    if ((status === EMsgStreamStatus.DONE || status === EMsgStreamStatus.READY) && !message?.trim()) {
      return <span>我先不想了，有需要可以随时问我</span>;
    }

    return children;
  }, [status, message, children]);

  return (
    <div className={styles.thinking_container}>
      <div className={styles.content}>{renderContent()}</div>
      <div className={styles.bottom_container}>
        <div className={styles.reset} onClick={handleReset}>
          <Icon className={`${getIcon('refresh')} ${styles.transform}`}></Icon>
          <span>重新生成</span>
        </div>
        {/* <div className={styles.thumbs}>
          <Thumbs/>
        </div> */}
      </div>
    </div>
  );
};
