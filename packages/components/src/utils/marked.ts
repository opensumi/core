import { marked, Renderer } from 'marked';

export type IMarkedOptions = marked.MarkedOptions;

export const createMarkedRenderer = () => new Renderer();

export const parseMarkdown = (
  value: string,
  options?: IMarkedOptions,
  callback?: (error: any, parseResult: string) => void,
) => {
  if (!callback) {
    return marked.parse(value, options);
  }
  if (options) {
    marked.parse(value, options, callback);
  } else {
    marked.parse(value, callback);
  }
};

export const toMarkdownHtml = (value: string, options?: IMarkedOptions) => marked(value, options);

export const parseWithoutEscape = (token: marked.Token) => {
  // 这里兼容下 vscode 的写法，vscode 这里没有处理 markdown 语法
  // 否则会出现 (\\) 被解析成 () 期望是 (\)
  if (token.type === 'escape') {
    token.text = token.raw;
  }

  return token;
};
