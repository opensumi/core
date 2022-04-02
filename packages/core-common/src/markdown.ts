import { IMarkdownString } from './types/markdown';

export function toMarkdownString(str: string, opts?: Omit<IMarkdownString, 'value'>): IMarkdownString {
  return {
    value: str,
    ...opts,
  };
}
