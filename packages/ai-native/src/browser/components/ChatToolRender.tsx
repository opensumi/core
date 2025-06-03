import cls from 'classnames';
import React, { useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { Loading } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { IChatToolContent, uuid } from '@opensumi/ide-core-common';
import { localize } from '@opensumi/ide-core-common/lib/localize';

import { TOOL_NAME_SEPARATOR } from '../../common/utils';
import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

import { CodeEditorWithHighlight } from './ChatEditor';
import styles from './ChatToolRender.module.less';
import { ChatToolResult } from './ChatToolResult';

export const ChatToolRender = (props: { value: IChatToolContent['content']; messageId?: string }) => {
  const { value, messageId } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const mcpServerFeatureRegistry = useInjectable<IMCPServerRegistry>(TokenMCPServerRegistry);

  if (!value || !value.function || !value.id) {
    return null;
  }
  const toolName = mcpServerFeatureRegistry.getMCPTool(value.function.name)?.label || value.function.name;
  const parts = toolName.split(TOOL_NAME_SEPARATOR);
  const label = parts.length >= 3 ? parts[2] : toolName;

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
    <div className={styles.chat_tool_render}>
      <div className={styles.tool_header} onClick={toggleExpand}>
        <div className={styles.tool_name}>
          <Icon iconClass={`codicon codicon-chevron-${isExpanded ? 'down' : 'right'}`} />
          <Icon size='small' iconClass={cls('codicon codicon-tools', styles.tool_icon)} />
          <span className={styles.tool_label}>
            <span className={styles.tool_prefix}>Called MCP Tool</span>
            <span className={styles.tool_name} title={label}>
              {label}
            </span>
          </span>
        </div>
        {value.state && (
          <div className={styles.tool_state}>
            <span className={styles.state_icon}>{stateInfo.icon}</span>
          </div>
        )}
      </div>
      <div className={cls(styles.tool_content, { [styles.expanded]: isExpanded })}>
        {value?.function?.arguments && (
          <div className={styles.tool_arguments}>
            <div className={styles.section_label}>{localize('ai.native.mcp.tool.arguments')}:</div>
            <CodeEditorWithHighlight input={value?.function?.arguments} language={'json'} relationId={uuid(4)} />
          </div>
        )}
        {value?.result && (
          <div className={styles.tool_result}>
            <div className={styles.section_label}>{localize('ai.native.mcp.tool.results')}:</div>
            <ChatToolResult result={value.result} relationId={uuid(4)} />
          </div>
        )}
      </div>
    </div>
  );
};
