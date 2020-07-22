import { UriComponents } from './uri';

// TODO: edtior 中有相同interface，待统一
export interface IMarkdownString {
  value: string;
  isTrusted?: boolean;
  uris?: { [href: string]: UriComponents };
}

export class MarkdownString implements IMarkdownString {
  private readonly _isTrusted: boolean;
  private readonly _supportThemeIcons: boolean;

  constructor(
    private _value: string = '',
    isTrustedOrOptions: boolean | { isTrusted?: boolean, supportThemeIcons?: boolean } = false,
  ) {
    if (typeof isTrustedOrOptions === 'boolean') {
      this._isTrusted = isTrustedOrOptions;
      this._supportThemeIcons = false;
    } else {
      this._isTrusted = isTrustedOrOptions.isTrusted ?? false;
      this._supportThemeIcons = isTrustedOrOptions.supportThemeIcons ?? false;
    }

  }

  get value() { return this._value; }
  get isTrusted() { return this._isTrusted; }
  get supportThemeIcons() { return this._supportThemeIcons; }

  appendText(value: string): MarkdownString {
    // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
    this._value += value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this._value += value;

    return this;
  }

  appendCodeblock(langId: string, code: string): MarkdownString {
    this._value += '\n```';
    this._value += langId;
    this._value += '\n';
    this._value += code;
    this._value += '\n```\n';
    return this;
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
