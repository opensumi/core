import { Renderer, marked } from 'marked';

import type { MarkedOptions, Token, Tokens } from 'marked';

export { marked };

export type IMarkedOptions = MarkedOptions;

export const createMarkedRenderer = () => new Renderer();

export const parseMarkdown = (value: string, options?: IMarkedOptions) => marked.parse(value, options);

export const toMarkdownHtml = (value: string, options?: IMarkedOptions) => marked(value, options);

export const parseWithoutEscape = (token: Token) => {
  // 这里兼容下 vscode 的写法，vscode 这里没有处理 markdown 语法
  // 否则会出现 (\\) 被解析成 () 期望是 (\)
  if (token.type === 'escape') {
    const escapeToken = token as Tokens.Escape;
    escapeToken.text = escapeToken.raw;
  }

  return token;
};
