import { marked } from 'marked';

export const createMarkedRenderer = () => new marked.Renderer();

export const parseMarkdown = (
  value: string,
  options?: marked.MarkedOptions,
  callback?: (error: any, parseResult: string) => void,
) => marked.parse(value, options, callback);

export const toMarkdownHtml = (value: string, options?: marked.MarkedOptions) => marked(value, options);
