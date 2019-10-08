import { Color, IThemeColor } from './color';
import { IRawTheme } from 'vscode-textmate';
import {vs, vs_dark, hc_black} from './default-themes';
import { Event } from '@ali/ide-core-common';

export const ThemeServicePath = 'themeServicePath';

export interface IThemeData extends ThemeMix {
  id: string;
  colorMap: IColorMap;
  initializeFromData(data): void;
  initializeThemeData(id, name, themeLocation: string): Promise<void>;
}

export interface IThemeService {
  onThemeChange: Event<ITheme>;
  registerThemes(themeContributions: ThemeContribution[], extPath: string): void;
  applyTheme(id?: string): Promise<void>;
  getAvailableThemeInfos(): ThemeInfo[];
  getCurrentTheme(): Promise<ITheme>;
  getCurrentThemeSync(): ITheme;
  getColor(id: string | IThemeColor | undefined): string | undefined;
  registerColor(contribution: ExtColorContribution): void;
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

export interface ThemeMix extends IRawTheme, IStandaloneThemeData {
  name: string;
}

const VS_THEME_NAME = 'vs';
const VS_DARK_THEME_NAME = 'vs-dark';
const HC_BLACK_THEME_NAME = 'hc-black';

export interface ThemeContribution {
  id?: string;
  label: string;
  uiTheme: BuiltinTheme;
  path: string;
}

// base themes
export const DARK: ThemeType = 'dark';
export const LIGHT: ThemeType = 'light';
export const HIGH_CONTRAST: ThemeType = 'hc';
export type ThemeType = 'light' | 'dark' | 'hc';

export function getBuiltinRules(builtinTheme: BuiltinTheme): IStandaloneThemeData {
  switch (builtinTheme) {
    case VS_THEME_NAME:
      return vs;
    case VS_DARK_THEME_NAME:
      return vs_dark;
    case HC_BLACK_THEME_NAME:
      return hc_black;
  }
}

export function getThemeTypeSelector(type: ThemeType): string {
  switch (type) {
    case DARK: return 'vs-dark';
    case HIGH_CONTRAST: return 'hc-black';
    default: return 'vs';
  }
}

export function getThemeType(base: BuiltinTheme) {
  switch (base) {
    case VS_THEME_NAME: return 'light';
    case VS_DARK_THEME_NAME: return 'dark';
    case HC_BLACK_THEME_NAME: return 'hc';
  }
}

export type ColorIdentifier = string;

export interface ITheme {
  readonly type: ThemeType;
  readonly themeData: IThemeData;

  /**
   * Resolves the color of the given color identifier. If the theme does not
   * specify the color, the default color is returned unless <code>useDefault</code> is set to false.
   * @param color the id of the color
   * @param useDefault specifies if the default color should be used. If not set, the default is used.
   */
  getColor(color: ColorIdentifier, useDefault?: boolean): Color | undefined;

  /**
   * Returns whether the theme defines a value for the color. If not, that means the
   * default color will be used.
   */
  defines(color: ColorIdentifier): boolean;
}

export interface ColorContribution {
  readonly id: ColorIdentifier;
  readonly description: string;
  readonly defaults: ColorDefaults | null;
  readonly needsTransparency: boolean;
  readonly deprecationMessage: string | undefined;
}

export interface ExtColorContribution {
  id: string;
  description: string;
  defaults: { light: string, dark: string, highContrast: string };
}

export type ColorFunction = (theme: ITheme) => Color | undefined;

export interface ColorDefaults {
  light: ColorValue | null;
  dark: ColorValue | null;
  hc: ColorValue | null;
}

/**
 * A Color Value is either a color literal, a refence to other color or a derived color
 */
export type ColorValue = Color | string | ColorIdentifier | ColorFunction;

export interface ThemeInfo {
  id: string;
  name: string;
  base: BuiltinTheme;
  themeId: string;
  inherit?: boolean;
}

export function themeColorFromId(id: ColorIdentifier) {
  return { id };
}
