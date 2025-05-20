import { IEditorDocumentModel } from '@opensumi/ide-editor';

import { BUILTIN_MCP_SERVER_NAME } from './index';

const BACK_QUOTE_3_SYMBOL = '```';
const MIN_PROMPT_CHARS = 10;

export const isDocumentTooLarge = (document: IEditorDocumentModel) => {
  try {
    document.getText();
  } catch (e) {
    if (e instanceof RangeError) {
      return true;
    }
  }
  return false;
};

export const isDocumentTooShort = (document: IEditorDocumentModel) => document.getText().length < MIN_PROMPT_CHARS;

export const isDocumentValid = (document: IEditorDocumentModel) => {
  if (isDocumentTooLarge(document) || isDocumentTooShort(document)) {
    return false;
  }
  return true;
};

// 从文本当中提取代码块内容
export const extractCodeBlocks = (content: string): string => {
  const lines = content.split('\n');

  let newContents: string[] = [];
  let inBlock = false;
  let startLine = 0;

  lines.forEach((line, i) => {
    if (!inBlock && line.trim().startsWith(BACK_QUOTE_3_SYMBOL)) {
      inBlock = true;
      startLine = i + 1;
    } else if (inBlock && line.trim().startsWith(BACK_QUOTE_3_SYMBOL)) {
      inBlock = false;
      const endLine = i;
      newContents = lines.slice(startLine, endLine);
    }

    if (inBlock && startLine !== i + 1) {
      newContents.push(line);
    }
  });

  return newContents.join('\n');
};

// 确保 Tool Name 符合 Claude 3.5+ Sonnet 要求的 ^[a-zA-Z0-9_-]{1,64}$ 正则
export const toClaudeToolName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

export const getToolName = (toolName: string, serverName: string) =>
  serverName === BUILTIN_MCP_SERVER_NAME ? toolName : toClaudeToolName(`mcp_${serverName}_${toolName}`);

export const cleanAttachedTextWrapper = (text: string) => {
  const rgAttachedFile = /`<attached_file>(.*)`/g;
  const rgAttachedFolder = /`<attached_folder>(.*)`/g;
  text = text.replace(rgAttachedFile, '$1');
  text = text.replace(rgAttachedFolder, '$1');
  return text;
};
