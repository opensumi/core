import { UriComponents } from './uri';
import { es5ClassCompat } from '@ali/ide-core-common';

// TODO: edtior 中有相同interface，待统一
export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  uris?: { [href: string]: UriComponents };
}

const escapeCodiconsRegex = /(\\)?\$\([a-z0-9\-]+?(?:~[a-z0-9\-]*?)?\)/gi;
export function escapeCodicons(text: string): string {
  return text.replace(escapeCodiconsRegex, (match, escaped) => escaped ? match : `\\${match}`);
}

@es5ClassCompat
export class MarkdownString {

  value: string;
  isTrusted?: boolean;
  readonly supportThemeIcons?: boolean;

  constructor(value?: string, supportThemeIcons: boolean = false) {
    this.value = value ?? '';
    this.supportThemeIcons = supportThemeIcons;
  }

  appendText(value: string): MarkdownString {
    // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
    this.value += (this.supportThemeIcons ? escapeCodicons(value) : value)
      .replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&')
      .replace(/\n/, '\n\n');

    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;

    return this;
  }

  appendCodeblock(code: string, language: string = ''): MarkdownString {
    this.value += '\n```';
    this.value += language;
    this.value += '\n';
    this.value += code;
    this.value += '\n```\n';
    return this;
  }

  static isMarkdownString(thing: any): thing is MarkdownString {
    if (thing instanceof MarkdownString) {
      return true;
    }
    return thing && thing.appendCodeblock && thing.appendMarkdown && thing.appendText && (thing.value !== undefined);
  }
}

// tslint:disable-next-line:no-any
export function isMarkdownString(thing: any): thing is IMarkdownString {
  if (thing instanceof MarkdownString) {
    return true;
  } else if (thing && typeof thing === 'object') {
    return typeof (thing as IMarkdownString).value === 'string'
      && (typeof (thing as IMarkdownString).isTrusted === 'boolean' || (thing as IMarkdownString).isTrusted === void 0);
  }
  return false;
}
