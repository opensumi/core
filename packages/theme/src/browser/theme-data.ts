import { Autowired, Injectable } from '@ali/common-di';
import { ITokenThemeRule, IColors, BuiltinTheme, ITokenColorizationRule, IColorMap, getThemeType, IThemeData } from '../common/theme.service';
import * as JSON5 from 'json5';
import { Registry, IRawThemeSetting } from 'vscode-textmate';
import { Path } from '@ali/ide-core-common/lib/path';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { parse as parsePList } from '../common/plistParser';
import { localize } from '@ali/ide-core-common';
import { convertSettings } from '../common/themeCompatibility';
import { Color } from '../common/color';
import URI from 'vscode-uri';

@Injectable({ multiple: true })
export class ThemeData implements IThemeData {

  id: string;
  name: string;
  settingsId: string;
  colors: IColors = {};
  encodedTokensColors: string[] = [];
  rules: ITokenThemeRule[] = [];
  settings: IRawThemeSetting[] = [];
  base: BuiltinTheme = 'vs-dark';
  inherit = false;

  colorMap: IColorMap = {};
  private hasDefaultTokens = false;

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  private safeParseJSON(content) {
    let json;
    try {
      json = JSON5.parse(content);
      return json;
    } catch (error) {
      return console.error('主题文件解析出错！', content);
    }
  }

  public initializeFromData(data) {
    this.id = data.id;
    this.name = data.name;
    this.settingsId = data.settingsId;
    this.colors = data.colors;
    this.encodedTokensColors = data.encodedTokensColors;
    this.rules = data.rules;
    this.settings = data.settings;
    this.base = data.base;
    this.inherit = data.inherit;
  }

  public async initializeThemeData(id, name, themeLocation: string) {
    this.id = id;
    this.name = name;
    this.base = this.basetheme;
    await this.loadColorTheme(themeLocation, this.settings, this.colorMap);
    for (const setting of this.settings) {
      this.transform(setting, (rule) => this.rules.push(rule));
    }
    if (!this.hasDefaultTokens) {
      defaultThemeColors[getThemeType(this.basetheme)].forEach((setting) => {
        this.transform(setting, (rule) => this.rules.push(rule));
      });
    }
    // tslint:disable-next-line
    for (const key in this.colorMap) {
      this.colors[key] = Color.Format.CSS.formatHex(this.colorMap[key]);
    }
    this.patchTheme();
  }

  private get basetheme(): BuiltinTheme {
    return this.id.split(' ')[0] as BuiltinTheme;
  }

  private async loadColorTheme(themeLocation: string, resultRules: ITokenColorizationRule[], resultColors: IColorMap): Promise<any> {
    console.time('theme ' + themeLocation);
    const themeContent = await this.fileServiceClient.resolveContent(URI.file(themeLocation).toString());
    console.timeEnd('theme ' + themeLocation);
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

  // 将encodedTokensColors转为monaco可用的形式
  private patchTheme() {
    this.encodedTokensColors = Object.keys(this.colors).map((key) => this.colors[key]);
    const reg = new Registry();
    reg.setTheme(this);
    // 当默认颜色不在settings当中时，此处不能使用之前那种直接给encodedTokenColors赋值的做法，会导致monaco使用时颜色错位（theia的bug
    if (this.settings.filter((setting) => !setting.scope).length === 0) {
      this.settings.unshift({
        settings: {
          foreground: this.colors['editor.foreground'],
          background: this.colors['editor.background'],
        },
      });
    }
    this.encodedTokensColors = reg.getColorMap();
    // index 0 has to be set to null as it is 'undefined' by default, but monaco code expects it to be null
    // tslint:disable-next-line:no-null-keyword
    this.encodedTokensColors[0] = null!;
  }

  private async loadSyntaxTokens(themeLocation): Promise<ITokenColorizationRule[]> {
    const {content} = await this.fileServiceClient.resolveContent(themeLocation);
    try {
      const theme = parsePList(content);
      const settings = theme.settings;
      if (!Array.isArray(settings)) {
        return Promise.reject(new Error(localize('error.plist.invalidformat', "Problem parsing tmTheme file: {0}. 'settings' is not array.")));
      }
      convertSettings(settings, this.settings, this.colorMap);
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
        if (typeof value === typeof '') {
          value = value.replace(/^\#/, '').slice(0, 6);
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
