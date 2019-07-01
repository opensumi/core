import { Event, URI } from '@ali/ide-core-common';
import { Color } from './color';
import { IRawTheme } from 'vscode-textmate';

export const ThemeServicePath = 'themeServicePath';

export interface IThemeService {
  // onCurrentThemeChange: Event<any>;

  getTheme(location: string): Promise<any>;
}

export const IThemeService = Symbol('IThemeService');

export interface ITokenColorizationRule {
  name?: string;
  scope?: string | string[];
  settings: ITokenColorizationSetting;
}

export interface ITokenColorizationSetting {
  foreground?: string;
  background?: string;
  fontStyle?: string;  // italic, underline, bold
}

export interface IColorMap {
  [id: string]: Color;
}

export type BuiltinTheme = 'vs' | 'vs-dark' | 'hc-black';

export interface IStandaloneThemeData {
  base: BuiltinTheme;
  inherit: boolean;
  rules: ITokenThemeRule[];
  encodedTokensColors?: string[];
  colors: IColors;
}

export interface IColors {
  [colorId: string]: string;
}

export interface ITokenThemeRule {
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

export interface ThemeMix extends IRawTheme, IStandaloneThemeData {  }
