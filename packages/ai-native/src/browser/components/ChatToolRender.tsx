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
      // 在流式状态中也尝试解析已有的参数
      const argsString = value.function?.arguments || '{}';

      // 如果是流式状态且参数字符串不完整，直接返回原始字符串用于显示
      if ((value.state === 'streaming-start' || value.state === 'streaming') && !argsString.endsWith('}')) {
        return argsString;
      }

      return JSON.parse(argsString);
    } catch (error) {
      // 解析失败时返回原始字符串，让用户看到当前的参数内容
      return value.function?.arguments || '{}';
    }
  };

  const getFormattedArgs = () => {
    try {
      const argsString = value.function?.arguments || '{}';

      // 如果是流式状态且参数字符串不完整，处理转义字符后直接返回
      if ((value.state === 'streaming-start' || value.state === 'streaming') && !argsString.endsWith('}')) {
        return unescapeJsonString(argsString);
      }

      // 尝试解析并格式化 JSON
      const parsed = JSON.parse(argsString);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      // 解析失败时，处理转义字符后返回原始字符串
      const argsString = value.function?.arguments || '{}';
      return unescapeJsonString(argsString);
    }
  };

  // 处理 JSON 字符串中的转义字符
  const unescapeJsonString = (str: string): string =>
     str
      .replace(/\\n/g, '\n') // 换行符
      .replace(/\\t/g, '\t') // 制表符
      .replace(/\\r/g, '\r') // 回车符
      .replace(/\\\\/g, '\\') // 反斜杠
      .replace(/\\"/g, '"') // 双引号
      .replace(/\\'/g, "'") // 单引号
      .replace(/\\f/g, '\f') // 换页符
      .replace(/\\b/g, '\b') // 退格符
      .replace(/\\v/g, '\v') // 垂直制表符
      .replace(/\\0/g, '\0') // 空字符
  ;

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
            <CodeEditorWithHighlight input={getFormattedArgs()} language={'json'} relationId={uuid(4)} />
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
