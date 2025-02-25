import cls from 'classnames';
import React, { useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { Loading } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IChatToolContent, uuid } from '@opensumi/ide-core-common';

import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

import { CodeEditorWithHighlight } from './ChatEditor';
import styles from './ChatToolRender.module.less';

export const ChatToolRender = (props: { value: IChatToolContent['content']; messageId?: string }) => {
  const { value, messageId } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const mcpServerFeatureRegistry = useInjectable<IMCPServerRegistry>(TokenMCPServerRegistry);

  if (!value || !value.function || !value.id) {
    return null;
  }
  const label = mcpServerFeatureRegistry.getMCPTool(value.function.name)?.label || value.function.name;

  const ToolComponent = mcpServerFeatureRegistry.getToolComponent(value.function.name);

  const getStateInfo = (state?: string): { label: string; icon: React.ReactNode } => {
    switch (state) {
      case 'streaming-start':
      case 'streaming':
        return { label: 'Generating', icon: <Loading /> };
      case 'complete':
        return { label: 'Complete', icon: <Icon iconClass='codicon codicon-check' /> };
      case 'result':
        return { label: 'Result Ready', icon: <Icon iconClass='codicon codicon-check-all' /> };
      default:
        return { label: state || 'Unknown', icon: <Icon iconClass='codicon codicon-question' /> };
    }
  };
  const getParsedArgs = () => {
    try {
      // TODO: 流式输出中function_call的参数还不完整，需要等待complete状态
      if (value.state !== 'complete' && value.state !== 'result') {
        return {};
      }
      return JSON.parse(value.function?.arguments || '{}');
    } catch (error) {
      return {};
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const stateInfo = getStateInfo(value.state);

  return ToolComponent && (value.state === 'complete' || value.state === 'result') ? (
    <ToolComponent
      state={value.state}
      args={getParsedArgs()}
      result={value.result}
      index={value.index}
      messageId={messageId}
      toolCallId={value.id}
    />
  ) : (
    <div className={styles['chat-tool-render']}>
      <div className={styles['tool-header']} onClick={toggleExpand}>
        <div className={styles['tool-name']}>
          <Icon iconClass={`codicon codicon-triangle-${isExpanded ? 'down' : 'right'}`} />
          {label}
        </div>
        {value.state && (
          <div className={styles['tool-state']}>
            <span className={styles['state-icon']}>{stateInfo.icon}</span>
          </div>
        )}
      </div>
      <div className={cls(styles['tool-content'], { [styles.expanded]: isExpanded })}>
        {value?.function?.arguments && (
          <div className={styles['tool-arguments']}>
            <div className={styles['section-label']}>Arguments</div>
            <CodeEditorWithHighlight input={value?.function?.arguments} language={'json'} relationId={uuid(4)} />
          </div>
        )}
        {value?.result && (
          <div className={styles['tool-result']}>
            <div className={styles['section-label']}>Result</div>
            <CodeEditorWithHighlight input={value.result} language={'json'} relationId={uuid(4)} />
          </div>
        )}
      </div>
    </div>
  );
};
