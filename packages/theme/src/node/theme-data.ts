import { Autowired, Injectable } from '@ali/common-di';
import { ITokenColorizationRule, IColorMap, IStandaloneThemeData } from '../common/theme.service';
import { FileService } from '@ali/ide-file-service';
import { URI } from '@ali/ide-core-common';
import { IRawTheme, Registry } from 'vscode-textmate';
import * as path from 'path';

export interface ThemeMix extends IRawTheme, IStandaloneThemeData {  }

@Injectable({ multiple: true })
export class ThemeData {

  id: string;
  label: string;
  settingsId: string;

  result: ThemeMix = {
    name: 'temp',
    // TODO vscode从主题id提取base
    base: 'vs',
    inherit: true,
    colors: {},
    rules: [],
    settings: [],
  };

  @Autowired()
  fileService: FileService;

  private safeParseJSON(content) {
    let json;
    try {
      json = JSON.parse(content);
      return json;
    } catch (error) {
      return console.error('主题文件解析出错！', content);
    }
  }

  public async initializeThemeData(id, label, themeLocation: string) {
    this.id = id;
    this.label = label;
    this.result = await this.loadColorTheme(themeLocation);
  }

  private async loadColorTheme(themeLocation: string): Promise<ThemeMix> {
    // TODO URI没有获取相对路径的方法吗？
    const themeContent = await this.fileService.resolveContent(themeLocation);
    const theme = this.safeParseJSON(themeContent.content);
    const result: ThemeMix = {
      name: theme.name,
      // TODO vscode从主题id提取base
      base: 'vs',
      inherit: true,
      colors: {},
      rules: [],
      settings: [],
    };

    // 部分主题可能依赖基础主题
    if (theme.include) {
      const includePath = path.join(path.dirname(themeLocation), theme.include);
      // 递归获取主题内容，push到配置内
      const parentTheme = await this.loadColorTheme(includePath);
      Object.assign(result.colors, parentTheme.colors);
      console.log(parentTheme);
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
    console.log(themeLocation, result);
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
