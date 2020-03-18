import { Autowired, Injectable } from '@ali/common-di';
import { ITokenThemeRule, IColors, BuiltinTheme, ITokenColorizationRule, IColorMap, getThemeType, IThemeData } from '../common/theme.service';
import { IRawThemeSetting } from 'vscode-textmate';
import { Path } from '@ali/ide-core-common/lib/path';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { parse as parsePList } from '../common/plistParser';
import { localize, parseWithComments, ILogger, IReporterService, REPORT_NAME } from '@ali/ide-core-common';
import { convertSettings } from '../common/themeCompatibility';
import { Color } from '../common/color';
import URI from 'vscode-uri';

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

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IReporterService)
  private reporter: IReporterService;

  public initializeFromData(data) {
    this.id = data.id;
    this.name = data.name;
    this.colors = data.colors;
    this.encodedTokensColors = data.encodedTokensColors;
    this.rules = data.rules;
    this.base = data.base;
    this.inherit = data.inherit;
  }

  public async initializeThemeData(id: string, name: string, base: string, themeLocation: string) {
    this.id = id;
    this.name = name;
    this.base = base as BuiltinTheme;
    await this.loadColorTheme(themeLocation, this.themeSettings, this.colorMap);
    // tslint:disable-next-line
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

  private async loadColorTheme(themeLocation: string, resultRules: ITokenColorizationRule[], resultColors: IColorMap): Promise<any> {
    const timer = this.reporter.time(REPORT_NAME.THEME_LOAD);
    const themeContent = await this.fileServiceClient.resolveContent(URI.file(themeLocation).toString());
    timer.timeEnd(themeLocation);
    if (/\.json$/.test(themeLocation)) {
      const theme = this.safeParseJSON(themeContent.content);
      let includeCompletes: Promise<any> = Promise.resolve(null);
      if (theme.include) {
        this.inherit = true;
        const includePath = new Path(themeLocation).dir.join(theme.include.replace(/^\.\//, '')).toString();
        includeCompletes = this.loadColorTheme(includePath, resultRules, resultColors);
      }
      await includeCompletes;
      // settings
      if (Array.isArray(theme.settings)) {
        convertSettings(theme.settings, resultRules, resultColors);
        return null;
      }
      // colors
      const colors = theme.colors;
      if (colors) {
        if (typeof colors !== 'object') {
          return Promise.reject(new Error(localize('error.invalidformat.colors', "Problem parsing color theme file: {0}. Property 'colors' is not of type 'object'.", themeLocation.toString())));
        }
        // new JSON color themes format
        // tslint:disable-next-line
        for (let colorId in colors) {
          const colorHex = colors[colorId];
          if (typeof colorHex === 'string') { // ignore colors tht are null
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
          const tokenPath = new Path(themeLocation).dir.join(tokenColors.replace(/^\.\//, '')).toString();
          // tmTheme
          return this.loadSyntaxTokens(tokenPath);
        } else {
          return Promise.reject(new Error(localize('error.invalidformat.tokenColors', "Problem parsing color theme file: {0}. Property 'tokenColors' should be either an array specifying colors or a path to a TextMate theme file", themeLocation.toString())));
        }
      }
      return null;
    } else {
      return this.loadSyntaxTokens(themeLocation);
    }
  }

  private async loadSyntaxTokens(themeLocation): Promise<ITokenColorizationRule[]> {
    const {content} = await this.fileServiceClient.resolveContent(URI.file(themeLocation).toString());
    try {
      const theme = parsePList(content);
      const settings = theme.settings;
      if (!Array.isArray(settings)) {
        return Promise.reject(new Error(localize('error.plist.invalidformat', "Problem parsing tmTheme file: {0}. 'settings' is not array.")));
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
        ...settings, token: scope,
      });
    }
  }
}

const defaultThemeColors: { [baseTheme: string]: ITokenColorizationRule[] } = {
  'light': [
    { scope: 'token.info-token', settings: { foreground: '#316bcd' } },
    { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
    { scope: 'token.error-token', settings: { foreground: '#cd3131' } },
    { scope: 'token.debug-token', settings: { foreground: '#800080' } },
  ],
  'dark': [
    { scope: 'token.info-token', settings: { foreground: '#6796e6' } },
    { scope: 'token.warn-token', settings: { foreground: '#cd9731' } },
    { scope: 'token.error-token', settings: { foreground: '#f44747' } },
    { scope: 'token.debug-token', settings: { foreground: '#b267e6' } },
  ],
  'hc': [
    { scope: 'token.info-token', settings: { foreground: '#6796e6' } },
    { scope: 'token.warn-token', settings: { foreground: '#008000' } },
    { scope: 'token.error-token', settings: { foreground: '#FF0000' } },
    { scope: 'token.debug-token', settings: { foreground: '#b267e6' } },
  ],
};
