import { IRawThemeSetting } from 'vscode-textmate';

import { Autowired, Injectable } from '@opensumi/di';
import {
  URI,
  localize,
  parseWithComments,
  ILogger,
  IReporterService,
  REPORT_NAME,
  isString,
  CharCode,
  isBoolean,
} from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { Color } from '../common/color';
import { editorBackground, editorForeground } from '../common/color-tokens/editor';
import { parse as parsePList } from '../common/plistParser';
import {
  createMatchers,
  ISemanticTokenRegistry,
  ITextMateThemingRule,
  Matcher,
  MatcherWithPriority,
  nameMatcher,
  noMatch,
  parseClassifierString,
  ProbeScope,
  SemanticTokenRule,
  TextMateThemingRuleDefinitions,
  TokenStyle,
  TokenStyleDefinition,
  TokenStyleDefinitions,
  TokenStyleValue,
} from '../common/semantic-tokens-registry';
import {
  ITokenThemeRule,
  IColors,
  BuiltinTheme,
  ITokenColorizationRule,
  IColorMap,
  getThemeType,
  IThemeData,
  ColorScheme,
  ISemanticTokenColorizationSetting,
} from '../common/theme.service';
import { convertSettings } from '../common/themeCompatibility';

function getScopeMatcher(rule: ITextMateThemingRule): Matcher<ProbeScope> {
  const ruleScope = rule.scope;
  if (!ruleScope || !rule.settings) {
    return noMatch;
  }
  const matchers: MatcherWithPriority<ProbeScope>[] = [];
  if (Array.isArray(ruleScope)) {
    for (const rs of ruleScope) {
      createMatchers(rs, nameMatcher, matchers);
    }
  } else {
    createMatchers(ruleScope, nameMatcher, matchers);
  }

  if (matchers.length === 0) {
    return noMatch;
  }
  return (scope: ProbeScope) => {
    let max = matchers[0].matcher(scope);
    for (let i = 1; i < matchers.length; i++) {
      max = Math.max(max, matchers[i].matcher(scope));
    }
    return max;
  };
}

function isSemanticTokenColorizationSetting(style: any): style is ISemanticTokenColorizationSetting {
  return (
    style &&
    (isString(style.foreground) ||
      isString(style.fontStyle) ||
      isBoolean(style.italic) ||
      isBoolean(style.underline) ||
      isBoolean(style.bold))
  );
}

@Injectable({ multiple: true })
export class ThemeData implements IThemeData {
  id: string;
  name: string;
  themeSettings: IRawThemeSetting[] = [];
  colors: IColors = {};
  encodedTokensColors: string[] = [];
  rules: ITokenThemeRule[] = [];
  base: BuiltinTheme = 'vs-dark';
  inherit = false;

  colorMap: IColorMap = {};
  private hasDefaultTokens = false;
  private customSettings: IRawThemeSetting[] = [];

  private semanticHighlighting?: boolean;

  private themeTokenScopeMatchers: Matcher<ProbeScope>[] | undefined;

  private tokenColorIndex: TokenColorIndex | undefined = undefined; // created on demand

  private semanticTokenRules: SemanticTokenRule[] = [];

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IReporterService)
  private reporter: IReporterService;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  public initializeFromData(data) {
    this.id = data.id;
    this.name = data.name;
    this.colors = data.colors;
    this.encodedTokensColors = data.encodedTokensColors;
    this.themeSettings = data.themeSettings;
    this.rules = data.rules;
    this.base = data.base;
    this.inherit = data.inherit;
  }

  get type(): ColorScheme {
    switch (this.base) {
      case 'vs':
        return ColorScheme.LIGHT;
      case 'hc-black':
        return ColorScheme.HIGH_CONTRAST;
      default:
        return ColorScheme.DARK;
    }
  }

  public async initializeThemeData(id: string, name: string, base: string, themeLocation: URI) {
    this.id = id;
    this.name = name;
    this.base = base as BuiltinTheme;
    await this.loadColorTheme(themeLocation, this.themeSettings, this.colorMap);
    // eslint-disable-next-line guard-for-in
    for (const key in this.colorMap) {
      this.colors[key] = Color.Format.CSS.formatHexA(this.colorMap[key]);
    }
  }

  public loadCustomTokens(customSettings: ITokenColorizationRule[]) {
    this.rules = [];
    // const affectedScopes: string[] = customSettings.map((setting) => setting.scope).filter((t) => !!t);
    this.doInitTokenRules();
    for (const setting of customSettings) {
      this.transform(setting, (rule) => {
        const existIndex = this.rules.findIndex((item) => item.token === rule.token);
        if (existIndex > -1) {
          this.rules.splice(existIndex, 1, rule);
        } else {
          this.rules.push(rule);
        }
      });
    }
    this.customSettings = customSettings;
  }

  public get settings() {
    return this.themeSettings.concat(this.customSettings);
  }

  public get tokenColors(): IRawThemeSetting[] {
    const result: IRawThemeSetting[] = [];
    const foreground = this.colorMap[editorForeground];
    const background = this.colorMap[editorBackground];
    result.push({
      settings: {
        foreground: normalizeColor(foreground),
        background: normalizeColor(background),
      },
    });

    let hasDefaultTokens = false;
    function addRule(rule: ITextMateThemingRule) {
      if (rule.scope && rule.settings) {
        if (rule.scope === 'token.info-token') {
          hasDefaultTokens = true;
        }
        result.push({
          scope: rule.scope,
          settings: {
            foreground: normalizeColor(rule.settings.foreground),
            background: normalizeColor(rule.settings.background),
            fontStyle: rule.settings.fontStyle,
          },
        });
      }
    }
    this.settings.map(addRule);
    if (!hasDefaultTokens) {
      defaultThemeColors[this.type].forEach(addRule);
    }
    return result;
  }

  // transform settings & init rules
  protected doInitTokenRules() {
    for (const setting of this.themeSettings) {
      this.transform(setting, (rule) => this.rules.push(rule));
    }
    if (!this.hasDefaultTokens) {
      defaultThemeColors[getThemeType(this.base)].forEach((setting) => {
        this.transform(setting, (rule) => this.rules.push(rule));
      });
    }
  }

  private safeParseJSON(content) {
    let json;
    try {
      json = parseWithComments(content);
      return json;
    } catch (error) {
      return this.logger.error('主题文件解析出错！', content);
    }
  }

  private readSemanticTokenRule(
    selectorString: string,
    settings: ISemanticTokenColorizationSetting | string | boolean | undefined,
  ): SemanticTokenRule | undefined {
    const selector = this.semanticTokenRegistry.parseTokenSelector(selectorString);
    let style: TokenStyle | undefined;
    if (typeof settings === 'string') {
      style = TokenStyle.fromSettings(settings, undefined);
    } else if (isSemanticTokenColorizationSetting(settings)) {
      style = TokenStyle.fromSettings(
        settings.foreground,
        settings.fontStyle,
        settings.bold,
        settings.underline,
        settings.italic,
      );
    }
    if (style) {
      return { selector, style };
    }
    return undefined;
  }

  private async loadColorTheme(
    themeLocation: URI,
    resultRules: ITokenColorizationRule[],
    resultColors: IColorMap,
  ): Promise<any> {
    const timer = this.reporter.time(REPORT_NAME.THEME_LOAD);
    const ret = await this.fileServiceClient.resolveContent(themeLocation.toString());
    const themeContent = ret.content;
    timer.timeEnd(themeLocation.toString());
    const themeLocationPath = themeLocation.path.toString();
    if (/\.json$/.test(themeLocationPath)) {
      const theme = this.safeParseJSON(themeContent);
      let includeCompletes: Promise<any> = Promise.resolve(null);
      if (theme.include) {
        this.inherit = true;
        // http 的不作支持
        const includePath = themeLocation.path.dir.join(theme.include.replace(/^\.\//, ''));
        const includeLocation = themeLocation.withPath(includePath);
        includeCompletes = this.loadColorTheme(includeLocation, resultRules, resultColors);
      }
      await includeCompletes;
      // settings
      if (Array.isArray(theme.settings)) {
        convertSettings(theme.settings, resultRules, resultColors);
        return null;
      }
      // semanticHighlighting enable/disabled
      this.semanticHighlighting = theme.semanticHighlighting;

      // semanticTokenColors
      const semanticTokenColors = theme.semanticTokenColors;
      if (semanticTokenColors && typeof semanticTokenColors === 'object') {
        // eslint-disable-next-line guard-for-in
        for (const key in semanticTokenColors) {
          try {
            const rule = this.readSemanticTokenRule(key, semanticTokenColors[key]);
            if (rule) {
              this.semanticTokenRules.push(rule);
            }
          } catch (err) {
            // ignore error
          }
        }
      }

      // colors
      const colors = theme.colors;
      if (colors) {
        if (typeof colors !== 'object') {
          return Promise.reject(
            new Error(
              localize(
                'error.invalidformat.colors',
                "Problem parsing color theme file: {0}. Property 'colors' is not of type 'object'.",
                themeLocation.toString(),
              ),
            ),
          );
        }
        // new JSON color themes format
        // eslint-disable-next-line guard-for-in
        for (const colorId in colors) {
          const colorHex = colors[colorId];
          if (typeof colorHex === 'string') {
            // ignore colors tht are null
            resultColors[colorId] = Color.fromHex(colors[colorId]);
          }
        }
      }
      // tokenColors
      const tokenColors = theme.tokenColors;
      if (tokenColors) {
        if (Array.isArray(tokenColors)) {
          resultRules.push(...tokenColors);
          return null;
        } else if (typeof tokenColors === 'string') {
          const tokenPath = themeLocation.path.dir.join(tokenColors.replace(/^\.\//, ''));
          const tokenLocation = themeLocation.withPath(tokenPath);
          // tmTheme
          return this.loadSyntaxTokens(tokenLocation);
        } else {
          return Promise.reject(
            new Error(
              localize(
                'error.invalidformat.tokenColors',
                "Problem parsing color theme file: {0}. Property 'tokenColors' should be either an array specifying colors or a path to a TextMate theme file",
                themeLocation.toString(),
              ),
            ),
          );
        }
      }

      return null;
    } else {
      return this.loadSyntaxTokens(themeLocation);
    }
  }

  private async loadSyntaxTokens(themeLocation: URI): Promise<ITokenColorizationRule[]> {
    const ret = await this.fileServiceClient.resolveContent(themeLocation.toString());
    try {
      const theme = parsePList(ret.content);
      const settings = theme.settings;
      if (!Array.isArray(settings)) {
        return Promise.reject(
          new Error(
            localize('error.plist.invalidformat', "Problem parsing tmTheme file: {0}. 'settings' is not array."),
          ),
        );
      }
      convertSettings(settings, this.themeSettings, this.colorMap);
      return Promise.resolve(settings);
    } catch (e) {
      return Promise.reject(new Error(localize('error.cannotparse', 'Problems parsing tmTheme file: {0}', e.message)));
    }
  }

  // 将 ITokenColorizationRule 转化为 ITokenThemeRule
  protected transform(tokenColor: ITokenColorizationRule, acceptor: (rule: monaco.editor.ITokenThemeRule) => void) {
    if (tokenColor.scope && tokenColor.settings && tokenColor.scope === 'token.info-token') {
      this.hasDefaultTokens = true;
    }
    if (typeof tokenColor.scope === 'undefined') {
      tokenColor.scope = [''];
    } else if (typeof tokenColor.scope === 'string') {
      // tokenColor.scope = tokenColor.scope.split(',').map((scope: string) => scope.trim()); // ?
      tokenColor.scope = [tokenColor.scope];
    }

    for (const scope of tokenColor.scope) {
      // Converting numbers into a format that monaco understands
      const settings = Object.keys(tokenColor.settings).reduce((previous: { [key: string]: string }, current) => {
        let value: string = tokenColor.settings[current];
        if (current !== 'foreground' && current !== 'background' && current !== 'fontStyle') {
          delete tokenColor.settings[current];
          return previous;
        }
        if (current !== 'fontStyle' && typeof value === 'string') {
          if (value.indexOf('#') === -1) {
            // 兼容 white、red 类型色值
            const color = Color[value];
            if (color) {
              value = Color.Format.CSS.formatHex(color);
              tokenColor.settings[current] = value;
            } else {
              // 去掉主题瞎写的值
              delete tokenColor.settings[current];
              return previous;
            }
          } else {
            const color = Color.fromHex(value);
            value = Color.Format.CSS.formatHex(color);
            // 主题只会识别 Hex 的色值
            tokenColor.settings[current] = value;
          }
        }
        previous[current] = value;
        return previous;
      }, {});

      acceptor({
        ...settings,
        token: scope,
      });
    }
  }

  public getTokenColorIndex(): TokenColorIndex {
    // collect all colors that tokens can have
    if (!this.tokenColorIndex) {
      const index = new TokenColorIndex();

      for (const color of this.encodedTokensColors) {
        index.add(color);
      }

      this.tokenColors.forEach((rule) => {
        index.add(rule.settings.foreground);
        index.add(rule.settings.background);
      });

      this.semanticTokenRules.forEach((r) => index.add(r.style.foreground));
      this.semanticTokenRegistry.getTokenStylingDefaultRules().forEach((r) => {
        const defaultColor = r.defaults[this.type];
        if (defaultColor && typeof defaultColor === 'object') {
          index.add(defaultColor.foreground);
        }
      });

      this.tokenColorIndex = index;
    }
    return this.tokenColorIndex;
  }

  public getTokenStyle(
    type: string,
    modifiers: string[],
    language: string,
    useDefault = true,
    definitions: TokenStyleDefinitions = {},
  ): TokenStyle | undefined {
    const result: any = {
      foreground: undefined,
      bold: undefined,
      underline: undefined,
      italic: undefined,
    };
    const score = {
      foreground: -1,
      bold: -1,
      underline: -1,
      italic: -1,
    };

    let hasUndefinedStyleProperty = false;
    // eslint-disable-next-line guard-for-in
    for (const k in score) {
      const key = k as keyof TokenStyle;
      if (score[key] === -1) {
        hasUndefinedStyleProperty = true;
      } else {
        score[key] = Number.MAX_VALUE; // set it to the max, so it won't be replaced by a default
      }
    }

    function _processStyle(matchScore: number, style: TokenStyle, definition: TokenStyleDefinition) {
      if (style.foreground && score.foreground <= matchScore) {
        score.foreground = matchScore;
        result.foreground = style.foreground;
        definitions.foreground = definition;
      }
      for (const p of ['bold', 'underline', 'italic']) {
        const property = p as keyof TokenStyle;
        const info = style[property];
        if (info !== undefined) {
          if (score[property] <= matchScore) {
            score[property] = matchScore;
            result[property] = info;
            definitions[property] = definition;
          }
        }
      }
    }

    function _processSemanticTokenRule(rule: SemanticTokenRule) {
      const matchScore = rule.selector.match(type, modifiers, language);
      if (matchScore >= 0) {
        _processStyle(matchScore, rule.style, rule);
      }
    }

    this.semanticTokenRules.forEach(_processSemanticTokenRule);

    if (hasUndefinedStyleProperty) {
      for (const rule of this.semanticTokenRegistry.getTokenStylingDefaultRules()) {
        const matchScore = rule.selector.match(type, modifiers, language);
        if (matchScore >= 0) {
          let style: TokenStyle | undefined;
          if (rule.defaults.scopesToProbe) {
            style = this.resolveScopes(rule.defaults.scopesToProbe);
            if (style) {
              _processStyle(matchScore, style, rule.defaults.scopesToProbe);
            }
          }

          if (!style && useDefault !== false) {
            const tokenStyleValue = rule.defaults[this.type];
            style = this.resolveTokenStyleValue(tokenStyleValue);
            if (style) {
              _processStyle(matchScore, style, tokenStyleValue!);
            }
          }
        }
      }
    }

    return TokenStyle.fromData(result);
  }

  /**
   * @param tokenStyleValue Resolve a tokenStyleValue in the context of a theme
   */
  public resolveTokenStyleValue(tokenStyleValue: TokenStyleValue | undefined): TokenStyle | undefined {
    if (tokenStyleValue === undefined) {
      return undefined;
    } else if (typeof tokenStyleValue === 'string') {
      const { type, modifiers, language } = parseClassifierString(tokenStyleValue, '');
      return this.getTokenStyle(type, modifiers, language);
    } else if (typeof tokenStyleValue === 'object') {
      return tokenStyleValue;
    }
    return undefined;
  }

  public resolveScopes(scopes: ProbeScope[], definitions?: TextMateThemingRuleDefinitions): TokenStyle | undefined {
    if (!this.themeTokenScopeMatchers) {
      this.themeTokenScopeMatchers = this.themeSettings.map(getScopeMatcher);
    }

    for (const scope of scopes) {
      let foreground: string | undefined;
      let fontStyle: string | undefined;
      let foregroundScore = -1;
      let fontStyleScore = -1;
      let fontStyleThemingRule: ITextMateThemingRule | undefined;
      let foregroundThemingRule: ITextMateThemingRule | undefined;

      function findTokenStyleForScopeInScopes(
        scopeMatchers: Matcher<ProbeScope>[],
        themingRules: ITextMateThemingRule[],
      ) {
        for (let i = 0; i < scopeMatchers.length; i++) {
          const score = scopeMatchers[i](scope);
          if (score >= 0) {
            const themingRule = themingRules[i];
            const settings = themingRules[i].settings;
            if (score >= foregroundScore && settings.foreground) {
              foreground = settings.foreground;
              foregroundScore = score;
              foregroundThemingRule = themingRule;
            }
            if (score >= fontStyleScore && isString(settings.fontStyle)) {
              fontStyle = settings.fontStyle;
              fontStyleScore = score;
              fontStyleThemingRule = themingRule;
            }
          }
        }
      }

      findTokenStyleForScopeInScopes(this.themeTokenScopeMatchers, this.themeSettings);

      if (foreground !== undefined || fontStyle !== undefined) {
        if (definitions) {
          definitions.foreground = foregroundThemingRule;
          definitions.bold = definitions.italic = definitions.underline = fontStyleThemingRule;
          definitions.scope = scope;
        }

        return TokenStyle.fromSettings(foreground, fontStyle);
      }
    }
    return undefined;
  }
}

function normalizeColor(color: string | Color | undefined | null): string | undefined {
  if (!color) {
    return undefined;
  }
  if (typeof color !== 'string') {
    color = Color.Format.CSS.formatHexA(color, true);
  }
  const len = color.length;
  if (color.charCodeAt(0) !== CharCode.Hash || (len !== 4 && len !== 5 && len !== 7 && len !== 9)) {
    return undefined;
  }
  const result = [CharCode.Hash];

  for (let i = 1; i < len; i++) {
    const upper = hexUpper(color.charCodeAt(i));
    if (!upper) {
      return undefined;
    }
    result.push(upper);
    if (len === 4 || len === 5) {
      result.push(upper);
    }
  }

  if (result.length === 9 && result[7] === CharCode.F && result[8] === CharCode.F) {
    result.length = 7;
  }
  return String.fromCharCode(...result);
}

function hexUpper(charCode: CharCode): number {
  if (
    (charCode >= CharCode.Digit0 && charCode <= CharCode.Digit9) ||
    (charCode >= CharCode.A && charCode <= CharCode.F)
  ) {
    return charCode;
  } else if (charCode >= CharCode.a && charCode <= CharCode.f) {
    return charCode - CharCode.a + CharCode.A;
  }
  return 0;
}

class TokenColorIndex {
  private _lastColorId: number;
  private _id2color: string[];
  private _color2id: { [color: string]: number };

  constructor() {
    this._lastColorId = 0;
    this._id2color = [];
    this._color2id = Object.create(null);
  }

  public add(color: string | Color | undefined): number {
    color = normalizeColor(color);
    if (color === undefined) {
      return 0;
    }

    let value = this._color2id[color];
    if (value) {
      return value;
    }
    value = ++this._lastColorId;
    this._color2id[color] = value;
    this._id2color[value] = color;
    return value;
  }

  public get(color: string | Color | undefined): number {
    color = normalizeColor(color);
    if (color === undefined) {
      return 0;
    }
    const value = this._color2id[color];
    if (value) {
      return value;
    }
    return 0;
  }

  public asArray(): string[] {
    return this._id2color.slice(0);
  }
}

const defaultThemeColors: { [baseTheme: string]: ITokenColorizationRule[] } = {
  light: [
    { scope: 'token.info-token', settings: { foreground: '#316bcd' } },
    { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
    { scope: 'token.error-token', settings: { foreground: '#cd3131' } },
    { scope: 'token.debug-token', settings: { foreground: '#800080' } },
  ],
  dark: [
    { scope: 'token.info-token', settings: { foreground: '#6796e6' } },
    { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
    { scope: 'token.error-token', settings: { foreground: '#f44747' } },
    { scope: 'token.debug-token', settings: { foreground: '#b267e6' } },
  ],
  hc: [
    { scope: 'token.info-token', settings: { foreground: '#6796e6' } },
    { scope: 'token.warn-token', settings: { foreground: '#008000' } },
    { scope: 'token.error-token', settings: { foreground: '#FF0000' } },
    { scope: 'token.debug-token', settings: { foreground: '#b267e6' } },
  ],
};
