import cls from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { MarkdownReactParser, MarkdownReactRenderer } from '@opensumi/ide-components/lib/markdown-react';
import { IMarkedOptions, marked } from '@opensumi/ide-components/lib/utils';
import { AppConfig, ConfigProvider, useInjectable } from '@opensumi/ide-core-browser';
import { IMarkdownString, MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import { CodeEditorWithHighlight } from './ChatEditor';
import styles from './components.module.less';

interface MarkdownProps {
  markdown: IMarkdownString | string;
  agentId?: string;
  command?: string;
  relationId?: string;
  className?: string;
  fillInIncompleteTokens?: boolean; // 补齐不完整的 token，如代码块或表格
  markedOptions?: IMarkedOptions;
  hideInsert?: boolean;
}

export const ChatMarkdown = (props: MarkdownProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const [reactParser, setReactParser] = useState<MarkdownReactParser>();
  const [tokensList, setTokensList] = useState<marked.TokensList>();

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const markdown: IMarkdownString =
      typeof props.markdown === 'string' ? new MarkdownString(props.markdown) : props.markdown;

    const renderer: MarkdownReactRenderer = new MarkdownReactRenderer();
    renderer.code = (code, lang) => {
      const language = postProcessCodeBlockLanguageId(lang);

      return (
        <div className={styles.code}>
          <ConfigProvider value={appConfig}>
            <div className={styles.code_block}>
              <div className={cls(styles.code_language, 'language-badge')}>{language}</div>
              <CodeEditorWithHighlight
                input={code as string}
                language={language}
                relationId={props.relationId || ''}
                agentId={props.agentId}
                command={props.command}
                hideInsert={props.hideInsert}
              />
            </div>
          </ConfigProvider>
        </div>
      );
    };
    renderer.codespan = (code) => <code className={styles.code_inline}>{code}</code>;

    const reactParser = new MarkdownReactParser({ renderer });
    const markedOptions = props.markedOptions ?? {};
    markedOptions.renderer = reactParser;

    let value = markdown.value ?? '';
    if (value.length > 100_000) {
      value = `${value.slice(0, 100_000)}…`;
    }

    let renderedMarkdown: string;
    let tokensList: marked.TokensList;
    if (props.fillInIncompleteTokens) {
      const opts = {
        ...marked.defaults,
        ...markedOptions,
      };
      const tokens = marked.lexer(value, opts);
      const newTokens = fillInIncompleteTokens(tokens);
      renderedMarkdown = marked.parser(newTokens, opts);
      tokensList = newTokens;
    } else {
      const tokens = marked.lexer(value, marked.defaults);
      renderedMarkdown = marked.parser(tokens, markedOptions);
      tokensList = tokens;
    }

    setTokensList(tokensList);
    setReactParser(reactParser);
  }, [props.markdown]);

  return (
    <div className={cls(styles.markdown_container, props.className)} ref={ref} tabIndex={0}>
      {tokensList && reactParser && reactParser.parse(tokensList)}
    </div>
  );
};

export function postProcessCodeBlockLanguageId(lang: string | undefined): string {
  if (!lang) {
    return '';
  }

  const parts = lang.split(/[\s+|:|,|\{|\?]/, 1);
  if (parts.length) {
    return parts[0];
  }
  return lang;
}

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
    if (type !== 'text') {
      continue;
    }

    const lines = raw.split('\n');
    const lastLine = lines[lines.length - 1];
    const patterns = [
      { condition: lastLine.includes('`'), action: completeCodespan },
      { condition: lastLine.includes('**'), action: completeDoublestar },
      { condition: lastLine.match(/\*\w/), action: completeStar },
      { condition: lastLine.match(/(^|\s)__\w/), action: completeDoubleUnderscore },
      { condition: lastLine.match(/(^|\s)_\w/), action: completeUnderscore },
      { condition: lastLine.match(/(^|\s)\[.*\]\(\w*/), action: completeLinkTarget },
      { condition: lastLine.match(/(^|\s)\[\w/), action: completeLinkText },
    ];

    for (const pattern of patterns) {
      if (pattern.condition) {
        return pattern.action(token);
      }
    }
  }

  return undefined;
}
