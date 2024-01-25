import React, { ReactNode, useEffect, useState, Fragment } from 'react';

import { marked, IMarkedOptions } from '@opensumi/ide-components/lib/utils';
import { IMarkdownString } from '@opensumi/ide-core-common';

import { CodeEditorWithHighlight } from './ChatEditor';
import * as styles from './components.module.less';

interface MarkdownProps {
  markdown: IMarkdownString;
  className?: string;
  fillInIncompleteTokens?: boolean; // 补齐不完整的 token，如代码块或表格
  markedOptions?: IMarkedOptions;
}

const renderMarkdown = ({ markdown, markedOptions = {}, ...options }: MarkdownProps): Array<string | ReactNode> => {
  const renderer = new marked.Renderer();
  renderer.link = (href: string | null, title: string | null, text: string): string => `<a rel="noopener" target="_blank" href="${href}" target="${href}" title="${title || href}">${text}</a>`;
  markedOptions.renderer = renderer;

  let value = markdown.value ?? '';
  if (value.length > 100_000) {
    value = `${value.slice(0, 100_000)}…`;
  }

  const renderedMarkdown: Array<string | ReactNode> = [];

  const opts = {
    ...marked.defaults,
    ...markedOptions,
  };
  let tokens = marked.lexer(value, opts);
  if (options.fillInIncompleteTokens) {
    tokens = fillInIncompleteTokens(tokens);
  }

  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'code') {
      renderedMarkdown.push(marked.parser(tokens.slice(start, i), opts));
      renderedMarkdown.push(
        <div className={styles.code_block}>
          <div className={styles.code_language}>{token.lang}</div>
          <CodeEditorWithHighlight input={token.text} language={token.lang} />
        </div>,
      );
      start = i + 1;
    }
  }
  if (start < tokens.length) {
    renderedMarkdown.push(marked.parser(tokens.slice(start), opts));
  }

  return renderedMarkdown;
};

export const Markdown = (props: MarkdownProps) => {
  const [nodes, setNodes] = useState<Array<string | ReactNode>>([]);

  useEffect(() => {
    setNodes(renderMarkdown(props));
  }, [props.markdown]);

  return (
    <div className={props.className}>
      {nodes.map((node, index) => {
        if (typeof node === 'string') {
          return <div dangerouslySetInnerHTML={{ __html: node }} key={index}></div>;
        }
        return node;
      })}
    </div>
  );
};

export function fillInIncompleteTokens(tokens: marked.TokensList): marked.TokensList {
  let i: number;
  let newTokens: marked.Token[] | undefined;
  for (i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // 代码块补全，完整的代码块 type=code
    if (token.type === 'paragraph' && token.raw.match(/(\n|^)```/)) {
      newTokens = completeCodeBlock(tokens.slice(i));
      break;
    }

    // 表格补全，完整的表格 type=table
    if (token.type === 'paragraph' && token.raw.match(/(\n|^)\|/)) {
      newTokens = completeTable(tokens.slice(i));
      break;
    }

    // 单行 token 补全，如 `a **a
    if (token.type === 'paragraph' && i === tokens.length - 1) {
      // Only operates on a single token, because any newline that follows this should break these patterns
      const newToken = completeSingleLinePattern(token);
      if (newToken) {
        newTokens = [newToken];
        break;
      }
    }
  }

  if (newTokens) {
    const newTokensList = [...tokens.slice(0, i), ...newTokens] as marked.TokensList;
    newTokensList.links = tokens.links;
    return newTokensList;
  }

  return tokens;
}

function completeCodeBlock(tokens: marked.Token[]): marked.Token[] {
  const mergedRawText = mergeRawTokenText(tokens);
  return marked.lexer(mergedRawText + '\n```');
}

function completeCodespan(token: marked.Token): marked.Token {
  return completeWithString(token, '`');
}

function completeStar(tokens: marked.Token): marked.Token {
  return completeWithString(tokens, '*');
}

function completeUnderscore(tokens: marked.Token): marked.Token {
  return completeWithString(tokens, '_');
}

function completeLinkTarget(tokens: marked.Token): marked.Token {
  return completeWithString(tokens, ')');
}

function completeLinkText(tokens: marked.Token): marked.Token {
  return completeWithString(tokens, '](about:blank)');
}

function completeDoublestar(tokens: marked.Token): marked.Token {
  return completeWithString(tokens, '**');
}

function completeDoubleUnderscore(tokens: marked.Token): marked.Token {
  return completeWithString(tokens, '__');
}

function completeWithString(tokens: marked.Token[] | marked.Token, closingString: string): marked.Token {
  const mergedRawText = mergeRawTokenText(Array.isArray(tokens) ? tokens : [tokens]);

  // If it was completed correctly, this should be a single token.
  // Expecting either a Paragraph or a List
  return marked.lexer(mergedRawText + closingString)[0] as marked.Token;
}

function completeTable(tokens: marked.Token[]): marked.Token[] | undefined {
  const mergedRawText = mergeRawTokenText(tokens);
  const lines = mergedRawText.split('\n');

  let numCols = 0;
  let hasSeparatorRow = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // 确定第一行有多少个 |
    if (typeof numCols === 'undefined' && line.match(/^\s*\|/)) {
      const line1Matches = line.match(/(\|[^\|]+)(?=\||$)/g);
      if (line1Matches) {
        numCols = line1Matches.length;
      }
    } else if (typeof numCols === 'number') {
      // 确定最后一行为分割行，否则表格可能不完整，此时不做任何渲染
      if (line.match(/^\s*\|/) && i === lines.length - 1) {
        hasSeparatorRow = true;
      } else {
        return undefined;
      }
    }
  }

  if (numCols > 0) {
    const prefixText = hasSeparatorRow ? lines.slice(0, -1).join('\n') : mergedRawText;
    const line1EndsInPipe = !!prefixText.match(/\|\s*$/);
    const newRawText = prefixText + (line1EndsInPipe ? '' : '|') + `\n|${' --- |'.repeat(numCols)}`;
    return marked.lexer(newRawText);
  }

  return undefined;
}

function mergeRawTokenText(tokens: marked.Token[]): string {
  return tokens.reduce((mergedTokenText, token) => mergedTokenText + token.raw, '');
}

function completeSingleLinePattern(token: marked.Tokens.ListItem | marked.Tokens.Paragraph): marked.Token | undefined {
  for (const { type, raw } of token.tokens) {
    if (type !== 'text') {continue;}

    const lines = raw.split('\n');
    const lastLine = lines[lines.length - 1];
    if (lastLine.includes('`')) {
      return completeCodespan(token);
    } else if (lastLine.includes('**')) {
      return completeDoublestar(token);
    } else if (lastLine.match(/\*\w/)) {
      return completeStar(token);
    } else if (lastLine.match(/(^|\s)__\w/)) {
      return completeDoubleUnderscore(token);
    } else if (lastLine.match(/(^|\s)_\w/)) {
      return completeUnderscore(token);
    } else if (lastLine.match(/(^|\s)\[.*\]\(\w*/)) {
      return completeLinkTarget(token);
    } else if (lastLine.match(/(^|\s)\[\w/)) {
      return completeLinkText(token);
    }
  }

  return undefined;
}
