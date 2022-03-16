import { IMarkdownString } from '@opensumi/ide-core-common';

import { illegalArgument } from '../utils';

const escapeCodiconsRegex = /(\\)?\$\([a-z0-9-]+?(?:~[a-z0-9-]*?)?\)/gi;
export function escapeCodicons(text: string): string {
  return text.replace(escapeCodiconsRegex, (match, escaped) => (escaped ? match : `\\${match}`));
}

export const enum MarkdownStringTextNewlineStyle {
  Paragraph = 0,
  Break = 1,
}

export function escapeMarkdownSyntaxTokens(text: string): string {
  // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
  return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
}
export class MarkdownString implements IMarkdownString {
  public value: string;
  public isTrusted?: boolean;
  public supportThemeIcons?: boolean;

  constructor(value = '', isTrustedOrOptions: boolean | { isTrusted?: boolean; supportThemeIcons?: boolean } = false) {
    this.value = value;
    if (typeof this.value !== 'string') {
      throw illegalArgument('value');
    }

    if (typeof isTrustedOrOptions === 'boolean') {
      this.isTrusted = isTrustedOrOptions;
      this.supportThemeIcons = false;
    } else {
      this.isTrusted = isTrustedOrOptions.isTrusted ?? undefined;
      this.supportThemeIcons = isTrustedOrOptions.supportThemeIcons ?? false;
    }
  }

  appendText(
    value: string,
    newlineStyle: MarkdownStringTextNewlineStyle = MarkdownStringTextNewlineStyle.Paragraph,
  ): MarkdownString {
    this.value += escapeMarkdownSyntaxTokens(this.supportThemeIcons ? escapeCodicons(value) : value)
      .replace(/([ \t]+)/g, (_match, g1) => '&nbsp;'.repeat(g1.length))
      .replace(/^>/gm, '\\>')
      .replace(/\n/g, newlineStyle === MarkdownStringTextNewlineStyle.Break ? '\\\n' : '\n\n');

    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(langId: string, code: string): MarkdownString {
    this.value += '\n```';
    this.value += langId;
    this.value += '\n';
    this.value += code;
    this.value += '\n```\n';
    return this;
  }
}

export function isMarkdownString(thing: any): thing is IMarkdownString {
  if (thing instanceof MarkdownString) {
    return true;
  } else if (thing && typeof thing === 'object') {
    return (
      typeof (thing as IMarkdownString).value === 'string' &&
      (typeof (thing as IMarkdownString).isTrusted === 'boolean' ||
        (thing as IMarkdownString).isTrusted === undefined) &&
      (typeof (thing as IMarkdownString).supportThemeIcons === 'boolean' ||
        (thing as IMarkdownString).supportThemeIcons === undefined)
    );
  }
  return false;
}

export function parseHrefAndDimensions(href: string): { href: string; dimensions: string[] } {
  const dimensions: string[] = [];
  const splitted = href.split('|').map((s) => s.trim());
  href = splitted[0];
  const parameters = splitted[1];
  if (parameters) {
    const heightFromParams = /height=(\d+)/.exec(parameters);
    const widthFromParams = /width=(\d+)/.exec(parameters);
    const height = heightFromParams ? heightFromParams[1] : '';
    const width = widthFromParams ? widthFromParams[1] : '';
    const widthIsFinite = isFinite(parseInt(width, 10));
    const heightIsFinite = isFinite(parseInt(height, 10));
    if (widthIsFinite) {
      dimensions.push(`width="${width}"`);
    }
    if (heightIsFinite) {
      dimensions.push(`height="${height}"`);
    }
  }
  return { href, dimensions };
}
