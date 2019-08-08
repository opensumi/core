import { UriComponents } from './uri';

// TODO: edtior 中有相同interface，待统一
export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  uris?: { [href: string]: UriComponents };
}
