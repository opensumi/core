import { sanitize } from 'dompurify';
import { marked, Renderer } from 'marked';

export type IMarkedOptions = marked.MarkedOptions;

export const createMarkedRenderer = () => new Renderer();

export const parseMarkdown = (
  value: string,
  options?: IMarkedOptions,
  callback?: (error: any, parseResult: string) => void,
) => {
  if (!callback) {
    return sanitize(marked.parse(value, options));
  }
  const wrappedCallback = (error: any, parseResult: string) => {
    callback(error, sanitize(parseResult));
  };
  if (options) {
    marked.parse(value, options, wrappedCallback);
  } else {
    marked.parse(value, wrappedCallback);
  }
};

export const toMarkdownHtml = (value: string, options?: IMarkedOptions) => sanitize(marked(value, options));
