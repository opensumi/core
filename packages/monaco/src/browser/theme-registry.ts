import { IRawTheme, Registry } from 'vscode-textmate';
import { Injectable } from '@ali/common-di';

export interface ThemeMix extends IRawTheme, monaco.editor.IStandaloneThemeData { }

@Injectable()
export class MonacoThemeRegistry {

  protected themes = new Map<string, ThemeMix>();

  getTheme(name: string): IRawTheme | undefined {
    return this.themes.get(name);
  }

  /**
   * Register VS Code compatible themes
   */
  register(
    json: any,
    includes?: { [includePath: string]: any },
    givenName?: string,
    monacoBase?: monaco.editor.BuiltinTheme,
  ): ThemeMix {
    const name = givenName || json.name!;
    const result: ThemeMix = {
      name,
      base: monacoBase || 'vs',
      inherit: true,
      colors: {},
      rules: [],
      settings: [],
    };
    if (this.themes.has(name)) {
      return this.themes.get(name)!;
    }
    this.themes.set(name, result);
    if (typeof json.include !== 'undefined') {
      if (!includes || !includes[json.include]) {
        // console.error(`Couldn't resolve includes theme ${json.include}.`);
      } else {
        const parentTheme = this.register(includes[json.include], includes);
        Object.assign(result.colors, parentTheme.colors);
        result.rules.push(...parentTheme.rules);
        result.settings.push(...parentTheme.settings);
      }
    }
    if (json.tokenColors) {
      result.settings.push(...json.tokenColors);
    }
    if (json.colors) {
      Object.assign(result.colors, json.colors);
      result.encodedTokensColors = Object.keys(result.colors).map((key) => result.colors[key]);
    }
    if (monacoBase && givenName) {
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
      monaco.editor.defineTheme(givenName, result);
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
