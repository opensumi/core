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
