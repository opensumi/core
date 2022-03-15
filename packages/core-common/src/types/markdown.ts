import { UriComponents } from '../uri';

export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  supportThemeIcons?: boolean;
  uris?: { [href: string]: UriComponents };
}
