import React, { useCallback } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';

import { AiChatService } from '../ai-chat.service';

import * as styles from './components.module.less';

interface ITinkingProps {
  children?: React.ReactNode;
  onPause?: () => void;
}

export const Thinking = ({ children, onPause }: ITinkingProps) => {
  const aiChatService = useInjectable<AiChatService>(AiChatService);

  const handlePause = useCallback(() => {
    aiChatService.cancelChatViewToken();
    if (onPause) {
      onPause();
    }
  }, []);

  return (
    <div className={styles.thinking_container}>
      <div className={styles.content}>{children ?? <span>Thinking...</span>}</div>
      <div className={styles.stop}>
        <span className={styles.progress_bar}>
          <Progress loading={true} style={{ width: '25%' }} wrapperClassName='ai-native-progress-wrapper' />
        </span>
        <div className={styles.block} onClick={handlePause}>
          <Icon className={getIcon('circle-pause')}></Icon>
          <span>停止</span>
        </div>
      </div>
    </div>
  );
};
