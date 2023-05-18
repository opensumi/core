import { marked, Renderer } from 'marked';

import { resolveDOMPurify } from './dompurify';

const dompurifyInstance = resolveDOMPurify();

export function sanitizeHtml(value: string) {
  return dompurifyInstance.sanitize(value);
}

export type IMarkedOptions = marked.MarkedOptions;

export const createMarkedRenderer = () => new Renderer();

export const parseMarkdown = (
  value: string,
  options?: IMarkedOptions,
  callback?: (error: any, parseResult: string) => void,
) => {
  if (!callback) {
    return sanitizeHtml(marked.parse(value, options));
  }
  const wrappedCallback = (error: any, parseResult: string) => {
    callback(error, sanitizeHtml(parseResult));
  };
  if (options) {
    marked.parse(value, options, wrappedCallback);
  } else {
    marked.parse(value, wrappedCallback);
  }
};

export const toMarkdownHtml = (value: string, options?: IMarkedOptions) => sanitizeHtml(marked(value, options));
