import cls from 'classnames';
import React, { useState } from 'react';

import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { Loading } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IChatToolContent, uuid } from '@opensumi/ide-core-common';

import { CodeEditorWithHighlight } from './ChatEditor';
import styles from './ChatToolRender.module.less';

export const ChatToolRender = (props: { value: IChatToolContent['content'] }) => {
  const { value } = props;
  const [isExpanded, setIsExpanded] = useState(false);

  if (!value || !value.function || !value.id) {
    return null;
  }

  const getStateInfo = (state?: string): { label: string; icon: React.ReactNode } => {
    switch (state) {
      case 'streaming-start':
      case 'streaming':
        return { label: 'Generating', icon: <Loading /> };
      case 'complete':
        return { label: 'Complete', icon: <Icon iconClass="codicon codicon-check" /> };
      case 'result':
        return { label: 'Result Ready', icon: <Icon iconClass="codicon codicon-check-all" /> };
      default:
        return { label: state || 'Unknown', icon: <Icon iconClass="codicon codicon-question" /> };
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const stateInfo = getStateInfo(value.state);

  return (
    <div className={styles['chat-tool-render']}>
      <div className={styles['tool-header']} onClick={toggleExpand}>
        <div className={styles['tool-name']}>
          <span className={cls(styles['expand-icon'], { [styles.expanded]: isExpanded })}>▶</span>
          {value?.function?.name}
        </div>
        {value.state && (
          <div className={styles['tool-state']}>
            <span className={styles['state-icon']}>{stateInfo.icon}</span>
            <span className={styles['state-label']}>{stateInfo.label}</span>
          </div>
        )}
      </div>
      <div className={cls(styles['tool-content'], { [styles.expanded]: isExpanded })}>
        {value?.function?.arguments && (
          <div className={styles['tool-arguments']}>
            <div className={styles['section-label']}>Arguments</div>
            <CodeEditorWithHighlight
              input={value?.function?.arguments}
              language={'json'}
              relationId={uuid(4)}
            />
          </div>
        )}
        {value?.result && (
          <div className={styles['tool-result']}>
            <div className={styles['section-label']}>Result</div>
            <CodeEditorWithHighlight
              input={value.result}
              language={'json'}
              relationId={uuid(4)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
