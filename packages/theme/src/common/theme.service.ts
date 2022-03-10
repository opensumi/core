import { IRawThemeSetting } from 'vscode-textmate';

import { Event, URI, IDisposable, IThemeColor } from '@opensumi/ide-core-common';

import { Color } from './color';
import { vs, vs_dark, hc_black } from './default-themes';

export const ThemeServicePath = 'themeServicePath';

export const DEFAULT_THEME_ID = 'ide-dark';
// from vscode
export const colorIdPattern = '^\\w+[.\\w+]*$';

export interface IIconTheme {
  hasFileIcons: boolean;
  hasFolderIcons: boolean;
  hidesExplorerArrows: boolean;
  styleSheetContent: string;
  load(location?: URI): Promise<string>;
}

export const IIconService = Symbol('IIconTheme');

export enum IconType {
  Mask = 'mask',
  Background = 'background',
  Base64 = 'base64',
}

export enum IconShape {
  Circle,
  Square,
}

export interface IIconService {
  currentThemeId: string;
  currentTheme: IIconTheme;

  onThemeChange: Event<IIconTheme>;
  /**
   * 应用主题（外部需要改主题请直接修改preference）
   * @param themeId 主题ID
   * */
  applyTheme(themeId: string): Promise<void>;
  /**
   * 将 codicon 的 id 转换为 codicon 的 class
   * @param str codicon id eg. $(add), $(add~sync)
   */
  fromString(str: string): string | undefined;
  /**
   * 将一个url地址或插件主题url转换为icon的class
   * @param basePath 路径前缀
   * @param icon iconUrl地址，可以是直接的字符串，或者和主题类型有关的 object 字符串对象
   * @param type 选择采用Mask或者Background的方式渲染icon资源, 默认值为IconType.Mask
   * @returns icon的className
   */
  fromIcon(
    basePath: string,
    icon?: { [index in ThemeType]: string } | string,
    type?: IconType,
    shape?: IconShape,
    fromExtension?: boolean,
  ): string | undefined;
  registerIconThemes(iconThemesContribution: ThemeContribution[], extPath: URI): void;
  getAvailableThemeInfos(): IconThemeInfo[];
}

export interface IThemeData extends IStandaloneThemeData {
  name: string;
  id: string;
  colorMap: IColorMap;
  themeSettings: IRawThemeSetting[];
  settings: IRawThemeSetting[];
  initializeFromData(data): void;
  initializeThemeData(id, name, base, themeLocation: URI): Promise<void>;
}

export interface IThemeService {
  currentThemeId: string;
  onThemeChange: Event<ITheme>;
  registerThemes(themeContributions: ThemeContribution[], extPath: URI): IDisposable;
  /**
   * 应用主题（外部需要改主题请直接修改preference）
   * @param id 主题ID
   */
  applyTheme(id: string): Promise<void>;
  getAvailableThemeInfos(): ThemeInfo[];
  getCurrentTheme(): Promise<ITheme>;
  getCurrentThemeSync(): ITheme;
  getColor(id: string | IThemeColor | undefined): string | undefined;
  getColorVar(id: string | IThemeColor | undefined): string | undefined;
  /**
   * 获取指定 color token 的 className
   */
  getColorClassNameByColorToken(colorId: string | IThemeColor | undefined): string | undefined;
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
  fontStyle?: string; // italic, underline, bold
}

export interface ISemanticTokenColorizationSetting {
  foreground?: string;
  fontStyle?: string /* [italic|underline|bold] */;
  bold?: boolean;
  underline?: boolean;
  italic?: boolean;
}

export interface IColorMap {
  [id: string]: Color;
}

/**
 * Color scheme used by the OS and by color themes.
 */
export enum ColorScheme {
  DARK = 'dark',
  LIGHT = 'light',
  HIGH_CONTRAST = 'hc',
}

export type BuiltinTheme = 'vs' | 'vs-dark' | 'hc-black';

export function getThemeTypeName(base: BuiltinTheme) {
  const map = {
    vs: 'theme.base.vs',
    'vs-dark': 'theme.base.vs-dark',
    'hc-black': 'theme.base.hc-black',
  };
  return map[base];
}

export enum BuiltinThemeComparator {
  'vs',
  'vs-dark',
  'hc-black',
}

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

export interface ITokenColorCustomizations {
  [groupIdOrThemeSettingsId: string]:
    | string
    | ITokenColorizationSetting
    | ITokenColorCustomizations
    | undefined
    | ITokenColorizationRule[];
  comments?: string | ITokenColorizationSetting;
  strings?: string | ITokenColorizationSetting;
  numbers?: string | ITokenColorizationSetting;
  keywords?: string | ITokenColorizationSetting;
  types?: string | ITokenColorizationSetting;
  functions?: string | ITokenColorizationSetting;
  variables?: string | ITokenColorizationSetting;
  textMateRules?: ITokenColorizationRule[];
}

const VS_THEME_NAME = 'vs';
const VS_DARK_THEME_NAME = 'vs-dark';
const HC_BLACK_THEME_NAME = 'hc-black';

export interface ThemeContribution {
  id?: string;
  label: string;
  // default to be vs
  uiTheme?: BuiltinTheme;
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
    case DARK:
      return 'vs-dark';
    case HIGH_CONTRAST:
      return 'hc-black';
    default:
      return 'vs';
  }
}

export function getThemeType(base: BuiltinTheme) {
  switch (base) {
    case VS_THEME_NAME:
      return 'light';
    case VS_DARK_THEME_NAME:
      return 'dark';
    case HC_BLACK_THEME_NAME:
      return 'hc';
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

export interface IColorCustomizations {
  [colorIdOrThemeSettingsId: string]: string | IColorCustomizations;
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
  defaults: { light: string; dark: string; highContrast: string };
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
  name: string;
  base: BuiltinTheme;
  themeId: string;
  inherit?: boolean;
}

export interface IconThemeInfo {
  name: string;
  themeId: string;
}

export function themeColorFromId(id: ColorIdentifier) {
  return { id };
}

export function getThemeId(contribution: ThemeContribution) {
  if (contribution.id) {
    return contribution.id;
  }
  return `${contribution.uiTheme || 'vs-dark'} ${toCSSSelector('vscode-theme', contribution.path)}`;
}

function toCSSSelector(extensionId: string, path: string) {
  if (path.indexOf('./') === 0) {
    path = path.substr(2);
  }
  let str = `${extensionId}-${path}`;

  // remove all characters that are not allowed in css
  str = str.replace(/[^_\-a-zA-Z0-9]/g, '-');
  if (str.charAt(0).match(/[0-9\-]/)) {
    str = '_' + str;
  }
  return str;
}
