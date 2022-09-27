import { marked, Renderer } from 'marked';

export const createMarkedRenderer = () => new Renderer();

export const parseMarkdown = (
  value: string,
  options?: marked.MarkedOptions,
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

export const toMarkdownHtml = (value: string, options?: marked.MarkedOptions) => marked(value, options);
