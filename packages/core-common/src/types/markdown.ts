import { UriComponents } from '@opensumi/ide-utils';

export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  supportThemeIcons?: boolean;
  supportHtml?: boolean;
  uris?: { [href: string]: UriComponents };
}
