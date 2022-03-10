import { IJSONSchema } from '@opensumi/ide-core-common/lib/json-schema';

import { Color } from './color';
import { ITokenColorizationSetting } from './theme.service';

export const ISemanticTokenRegistry = Symbol('ISemanticTokenRegistry');

export const TOKEN_TYPE_WILDCARD = '*';
export const TOKEN_CLASSIFIER_LANGUAGE_SEPARATOR = ':';
export const CLASSIFIER_MODIFIER_SEPARATOR = '.';

const CHAR_LANGUAGE = TOKEN_CLASSIFIER_LANGUAGE_SEPARATOR.charCodeAt(0);
const CHAR_MODIFIER = CLASSIFIER_MODIFIER_SEPARATOR.charCodeAt(0);

// qualified string [type|*](.modifier)*(/language)!
export type TokenClassificationString = string;

export const idPattern = '\\w+[-_\\w+]*';
export const typeAndModifierIdPattern = `^${idPattern}$`;

export const selectorPattern = `^(${idPattern}|\\*)(\\${CLASSIFIER_MODIFIER_SEPARATOR}${idPattern})*(\\${TOKEN_CLASSIFIER_LANGUAGE_SEPARATOR}${idPattern})?$`;

export const fontStylePattern = '^(\\s*(italic|bold|underline))*\\s*$';

export interface TokenSelector {
  match(type: string, modifiers: string[], language: string): number;
  readonly id: string;
}

export interface SemanticTokenDefaultRule {
  selector: TokenSelector;
  defaults: TokenStyleDefaults;
}

export interface TokenTypeOrModifierContribution {
  readonly num: number;
  readonly id: string;
  readonly superType?: string;
  readonly description: string;
  readonly deprecationMessage?: string;
}

export interface TokenStyleData {
  foreground?: Color;
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
}

export class TokenStyle implements Readonly<TokenStyleData> {
  constructor(
    public readonly foreground?: Color,
    public readonly bold?: boolean,
    public readonly underline?: boolean,
    public readonly italic?: boolean,
  ) {}
}

export namespace TokenStyle {
  export function toJSONObject(style: TokenStyle): any {
    return {
      _foreground: style.foreground === undefined ? null : Color.Format.CSS.formatHexA(style.foreground, true),
      _bold: style.bold === undefined ? null : style.bold,
      _underline: style.underline === undefined ? null : style.underline,
      _italic: style.italic === undefined ? null : style.italic,
    };
  }
  export function fromJSONObject(obj: any): TokenStyle | undefined {
    if (obj) {
      const boolOrUndef = (b: any) => (typeof b === 'boolean' ? b : undefined);
      const colorOrUndef = (s: any) => (typeof s === 'string' ? Color.fromHex(s) : undefined);
      return new TokenStyle(
        colorOrUndef(obj._foreground),
        boolOrUndef(obj._bold),
        boolOrUndef(obj._underline),
        boolOrUndef(obj._italic),
      );
    }
    return undefined;
  }
  export function equals(s1: any, s2: any): boolean {
    if (s1 === s2) {
      return true;
    }
    return (
      s1 !== undefined &&
      s2 !== undefined &&
      (s1.foreground instanceof Color ? s1.foreground.equals(s2.foreground) : s2.foreground === undefined) &&
      s1.bold === s2.bold &&
      s1.underline === s2.underline &&
      s1.italic === s2.italic
    );
  }
  export function is(s: any): s is TokenStyle {
    return s instanceof TokenStyle;
  }
  export function fromData(data: {
    foreground?: Color;
    bold?: boolean;
    underline?: boolean;
    italic?: boolean;
  }): TokenStyle {
    return new TokenStyle(data.foreground, data.bold, data.underline, data.italic);
  }
  export function fromSettings(
    foreground: string | undefined,
    fontStyle: string | undefined,
    bold?: boolean,
    underline?: boolean,
    italic?: boolean,
  ): TokenStyle {
    let foregroundColor: Color | undefined;
    if (foreground !== undefined) {
      foregroundColor = Color.fromHex(foreground);
    }
    if (fontStyle !== undefined) {
      bold = italic = underline = false;
      const expression = /italic|bold|underline/g;
      let match;
      while ((match = expression.exec(fontStyle))) {
        switch (match[0]) {
          case 'bold':
            bold = true;
            break;
          case 'italic':
            italic = true;
            break;
          case 'underline':
            underline = true;
            break;
        }
      }
    }
    return new TokenStyle(foregroundColor, bold, underline, italic);
  }
}

export interface SemanticTokenRule {
  style: TokenStyle;
  selector: TokenSelector;
}

export interface ITextMateThemingRule {
  name?: string;
  scope?: string | string[];
  settings: ITokenColorizationSetting;
}

export type TokenStyleDefinition = SemanticTokenRule | ProbeScope[] | TokenStyleValue;
export type TokenStyleDefinitions = {
  [P in keyof TokenStyleData]?: TokenStyleDefinition | undefined;
};

export type TextMateThemingRuleDefinitions = {
  [P in keyof TokenStyleData]?: ITextMateThemingRule | undefined;
} & { scope?: ProbeScope };

/**
 * A TokenStyle Value is either a token style literal, or a TokenClassificationString
 */
export type TokenStyleValue = TokenStyle | TokenClassificationString;

export type ProbeScope = string[];

export type Matcher<T> = (matcherInput: T) => number;

export const noMatch = (_scope: ProbeScope) => -1;

export function nameMatcher(identifers: string[], scope: ProbeScope): number {
  function findInIdents(s: string, lastIndent: number): number {
    for (let i = lastIndent - 1; i >= 0; i--) {
      if (scopesAreMatching(s, identifers[i])) {
        return i;
      }
    }
    return -1;
  }
  if (scope.length < identifers.length) {
    return -1;
  }
  let lastScopeIndex = scope.length - 1;
  let lastIdentifierIndex = findInIdents(scope[lastScopeIndex--], identifers.length);
  if (lastIdentifierIndex >= 0) {
    const score = (lastIdentifierIndex + 1) * 0x10000 + identifers[lastIdentifierIndex].length;
    while (lastScopeIndex >= 0) {
      lastIdentifierIndex = findInIdents(scope[lastScopeIndex--], lastIdentifierIndex);
      if (lastIdentifierIndex === -1) {
        return -1;
      }
    }
    return score;
  }
  return -1;
}

export interface MatcherWithPriority<T> {
  matcher: Matcher<T>;
  priority: -1 | 0 | 1;
}

function isIdentifier(token: string | null): token is string {
  return !!token && !!token.match(/[\w.:]+/);
}

function newTokenizer(input: string): { next: () => string | null } {
  const regex = /([LR]:|[\w.:][\w.:-]*|[,|\-()])/g;
  let match = regex.exec(input);
  return {
    next: () => {
      if (!match) {
        return null;
      }
      const res = match[0];
      match = regex.exec(input);
      return res;
    },
  };
}

export function createMatchers<T>(
  selector: string,
  matchesName: (names: string[], matcherInput: T) => number,
  results: MatcherWithPriority<T>[],
): void {
  const tokenizer = newTokenizer(selector);
  let token = tokenizer.next();
  while (token !== null) {
    let priority: -1 | 0 | 1 = 0;
    if (token.length === 2 && token.charAt(1) === ':') {
      switch (token.charAt(0)) {
        case 'R':
          priority = 1;
          break;
        case 'L':
          priority = -1;
          break;
        default:
          // eslint-disable-next-line no-console
          console.log(`Unknown priority ${token} in scope selector`);
      }
      token = tokenizer.next();
    }
    const matcher = parseConjunction();
    if (matcher) {
      results.push({ matcher, priority });
    }
    if (token !== ',') {
      break;
    }
    token = tokenizer.next();
  }

  function parseOperand(): Matcher<T> | null {
    if (token === '-') {
      token = tokenizer.next();
      const expressionToNegate = parseOperand();
      if (!expressionToNegate) {
        return null;
      }
      return (matcherInput) => {
        const score = expressionToNegate(matcherInput);
        return score < 0 ? 0 : -1;
      };
    }
    if (token === '(') {
      token = tokenizer.next();
      const expressionInParents = parseInnerExpression();
      if (token === ')') {
        token = tokenizer.next();
      }
      return expressionInParents;
    }
    if (isIdentifier(token)) {
      const identifiers: string[] = [];
      do {
        identifiers.push(token);
        token = tokenizer.next();
      } while (isIdentifier(token));
      return (matcherInput) => matchesName(identifiers, matcherInput);
    }
    return null;
  }
  function parseConjunction(): Matcher<T> | null {
    let matcher = parseOperand();
    if (!matcher) {
      return null;
    }

    const matchers: Matcher<T>[] = [];
    while (matcher) {
      matchers.push(matcher);
      matcher = parseOperand();
    }
    return (matcherInput) => {
      // and
      let min = matchers[0](matcherInput);
      for (let i = 1; min >= 0 && i < matchers.length; i++) {
        min = Math.min(min, matchers[i](matcherInput));
      }
      return min;
    };
  }
  function parseInnerExpression(): Matcher<T> | null {
    let matcher = parseConjunction();
    if (!matcher) {
      return null;
    }
    const matchers: Matcher<T>[] = [];
    while (matcher) {
      matchers.push(matcher);
      if (token === '|' || token === ',') {
        do {
          token = tokenizer.next();
        } while (token === '|' || token === ','); // ignore subsequent commas
      } else {
        break;
      }
      matcher = parseConjunction();
    }
    return (matcherInput) => {
      // or
      let max = matchers[0](matcherInput);
      for (let i = 1; i < matchers.length; i++) {
        max = Math.max(max, matchers[i](matcherInput));
      }
      return max;
    };
  }
}

function scopesAreMatching(thisScopeName: string, scopeName: string): boolean {
  if (!thisScopeName) {
    return false;
  }
  if (thisScopeName === scopeName) {
    return true;
  }
  const len = scopeName.length;
  return thisScopeName.length > len && thisScopeName.substr(0, len) === scopeName && thisScopeName[len] === '.';
}

export interface TokenStyleDefaults {
  scopesToProbe?: ProbeScope[];
  light?: TokenStyleValue;
  dark?: TokenStyleValue;
  hc?: TokenStyleValue;
}

export interface ISemanticTokenRegistry {
  /**
   * Parses a token selector from a selector string.
   * @param selectorString selector string in the form (*|type)(.modifier)*
   * @param language language to which the selector applies or undefined if the selector is for all language
   * @returns the parsed selector
   * @throws an error if the string is not a valid selector
   */
  parseTokenSelector(selectorString: string, language?: string): TokenSelector;

  /**
   * Register a TokenStyle default to the registry.
   * @param selector The rule selector
   * @param defaults The default values
   */
  registerTokenStyleDefault(selector: TokenSelector, defaults: TokenStyleDefaults): void;

  /**
   * Deregister a TokenStyle default to the registry.
   * @param selector The rule selector
   */
  deregisterTokenStyleDefault(selector: TokenSelector): void;

  /**
   * The styling rules to used when a schema does not define any styling rules.
   */
  getTokenStylingDefaultRules(): SemanticTokenDefaultRule[];

  /**
   * Register a token type to the registry.
   * @param id The TokenType id as used in theme description files
   * @param description the description
   */
  registerTokenType(id: string, description: string, superType?: string, deprecationMessage?: string): void;

  /**
   * Register a token modifier to the registry.
   * @param id The TokenModifier id as used in theme description files
   * @param description the description
   */
  registerTokenModifier(id: string, description: string, deprecationMessage?: string): void;
}

export function parseClassifierString(
  s: string,
  defaultLanguage: string,
): { type: string; modifiers: string[]; language: string };
export function parseClassifierString(
  s: string,
  defaultLanguage?: string,
): { type: string; modifiers: string[]; language: string | undefined };
export function parseClassifierString(
  s: string,
  defaultLanguage: string | undefined,
): { type: string; modifiers: string[]; language: string | undefined } {
  let k = s.length;
  let language: string | undefined = defaultLanguage;
  const modifiers: string[] = [];

  for (let i = k - 1; i >= 0; i--) {
    const ch = s.charCodeAt(i);
    if (ch === CHAR_LANGUAGE || ch === CHAR_MODIFIER) {
      const segment = s.substring(i + 1, k);
      k = i;
      if (ch === CHAR_LANGUAGE) {
        language = segment;
      } else {
        modifiers.push(segment);
      }
    }
  }
  const type = s.substring(0, k);
  return { type, modifiers, language };
}

export function getStylingSchemeEntry(description?: string, deprecationMessage?: string): IJSONSchema {
  return {
    description,
    deprecationMessage,
    defaultSnippets: [{ body: '${1:#ff0000}' }],
    anyOf: [
      {
        type: 'string',
        format: 'color-hex',
      },
      {
        $ref: '#definitions/style',
      },
    ],
  };
}
