import { Autowired, Injectable } from '@ali/common-di';
import { ThemeMix, ITokenThemeRule, IColors, BuiltinTheme } from '../common/theme.service';
import { IFileService } from '@ali/ide-file-service';
import * as JSON5 from 'json5';
import { Registry, IRawThemeSetting } from 'vscode-textmate';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';

@Injectable({ multiple: true })
export class ThemeData implements ThemeMix {

  id: string;
  name: string;
  settingsId: string;
  colors: IColors = {};
  encodedTokensColors: string[] = [];
  rules: ITokenThemeRule[] = [];
  settings: IRawThemeSetting[] = [];
  base: BuiltinTheme = 'vs-dark';
  inherit = false;

  @Autowired()
  private fileServiceClient: FileServiceClient;

  private safeParseJSON(content) {
    let json;
    try {
      json = JSON5.parse(content);
      return json;
    } catch (error) {
      return console.error('主题文件解析出错！', content);
    }
  }

  public get theme(): ThemeMix {
    return {
      encodedTokensColors: this.encodedTokensColors,
      colors: this.colors,
      rules: this.rules,
      settings: this.settings,
      base: this.base,
      inherit: this.inherit,
      name: this.name,
    };
  }

  public async initializeThemeData(id, name, themeLocation: string) {
    this.id = id;
    this.name = name;
    this.base = this.basetheme;
    const result = await this.loadColorTheme(themeLocation);
    this.colors = result.colors;
    this.rules = result.rules;
    this.settings = result.settings;
    if (result.encodedTokensColors) {
      this.encodedTokensColors = result.encodedTokensColors;
    }
  }

  private get basetheme(): BuiltinTheme {
    console.log(this.id, this.id.split(' ')[0]);
    return this.id.split(' ')[0] as BuiltinTheme;
  }

  private async loadColorTheme(themeLocation: string): Promise<ThemeMix> {
    const themeContent = await this.fileServiceClient.resolveContent(themeLocation);
    const theme = this.safeParseJSON(themeContent.content);
    const result: ThemeMix = {
      name: theme.name,
      base: 'vs',
      inherit: true,
      colors: {},
      rules: [],
      settings: [],
    };

    // 部分主题可能依赖基础主题
    if (theme.include) {
      // 若有包含关系，则需要继承？
      this.inherit = true;
      // 这个Path模块不支持 ./ 写法，很不好用啊！
      const includePath = new Path(themeLocation).dir.join(theme.include.replace(/^\.\//, '')).toString();
      // 递归获取主题内容，push到配置内
      const parentTheme = await this.loadColorTheme(includePath);
      Object.assign(result.colors, parentTheme.colors);
      result.rules.push(...parentTheme.rules);
      result.settings.push(...parentTheme.settings);
    }
    // 配置的转换
    if (theme.tokenColors) {
      result.settings.push(...theme.tokenColors);
    }
    if (theme.colors) {
      Object.assign(result.colors, theme.colors);
      result.encodedTokensColors = Object.keys(result.colors).map((key) => result.colors[key]);
    }
    for (const setting of result.settings) {
      this.transform(setting, (rule) => result.rules.push(rule));
    }
    const reg = new Registry();
    reg.setTheme(result);
    result.encodedTokensColors = reg.getColorMap();
    // index 0 has to be set to null as it is 'undefined' by default, but monaco code expects it to be null
    // tslint:disable-next-line:no-null-keyword
    result.encodedTokensColors[0] = null!;
    // index 1 and 2 are the default colors
    if (result.colors && result.colors['editor.foreground']) {
      result.encodedTokensColors[1] = result.colors['editor.foreground'];
    }
    if (result.colors && result.colors['editor.background']) {
      result.encodedTokensColors[2] = result.colors['editor.background'];
    }
    return result;
  }

  protected transform(tokenColor: any, acceptor: (rule: monaco.editor.ITokenThemeRule) => void) {
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
