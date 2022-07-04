import { UriComponents } from '@opensumi/ide-utils';

export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  supportThemeIcons?: boolean;
  supportHtml?: boolean;
  baseUri?: UriComponents;
  uris?: { [href: string]: UriComponents };
}
