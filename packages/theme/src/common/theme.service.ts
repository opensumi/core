import { IRawThemeSetting } from 'vscode-textmate';

import { Deferred, Event, IDisposable, IThemeColor, MaybePromise, URI } from '@opensumi/ide-core-common';

import { Color } from './color';
import { hc_black, hc_light, vs, vs_dark } from './default-themes';
import { IconContribution, IconDefinition } from './icon-registry';

export const ThemeServicePath = 'themeServicePath';

export const DEFAULT_THEME_ID = 'ide-dark';

export const DEFAULT_PRODUCT_ICON_THEME_ID = 'opensumi-icons';
export const DEFAULT_PRODUCT_ICON_THEME_LABEL = 'OpenSumi Icons';

export const PRODUCT_ICON_STYLE_ID = 'product-icon-style';
// codiconStyles 为 monaco 内置样式表
export const PRODUCT_ICON_CODICON_STYLE_ID = 'codiconStyles';
// from vscode
export const colorIdPattern = '^\\w+[.\\w+]*$';

export const IIconService = Symbol('IIconTheme');
export const IThemeService = Symbol('IThemeService');
export const IProductIconService = Symbol('IProductIconService');
export interface IIconTheme {
  hasFileIcons: boolean;
  hasFolderIcons: boolean;
  hidesExplorerArrows: boolean;
  styleSheetContent: string;
  load(location?: URI): Promise<string>;
}
export interface IProductIconTheme {
  /**
   * Resolves the definition for the given icon as defined by the theme.
   *
   * @param iconContribution The icon
   */
  readonly id: string;
  readonly label: string;
  readonly extensionData?: ExtensionData;
  readonly description?: string;
  readonly settingsId: string | null;
  styleSheetContent?: string;
  getIcon(iconContribution: IconContribution): IconDefinition | undefined;
}

export interface ExtensionData {
  extensionId: string;
  extensionPublisher: string;
  extensionName: string;
  extensionIsBuiltin: boolean;
}

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
  iconThemeLoaded: Deferred<void>;

  onThemeChange: Event<IIconTheme>;
  /**
   * 应用主题（外部需要改主题请直接修改preference）
   * @param themeId 主题ID
   * */
  applyTheme(themeId: string): Promise<void>;
  /**
   * 将 Base64 路径进行转义，便于在 `background: url("${iconPath}")` 结构中使用
   * @param iconPath Base64 路径
   */
  encodeBase64Path(iconPath: string): string;
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
    icon?: { [index in IconThemeType]: string } | string,
    type?: IconType,
    shape?: IconShape,
    fromExtension?: boolean,
  ): string | undefined;
  registerIconThemes(iconThemesContribution: IThemeContribution[], extPath: URI): void;

  getAvailableThemeInfos(): IconThemeInfo[];
}

export const IThemeData = Symbol('IThemeData');

export interface IThemeData extends IStandaloneThemeData {
  name: string;
  id: string;
  colorMap: IColorMap;
  themeSettings: IRawThemeSetting[];
  settings: IRawThemeSetting[];
  initializeFromData(data): void;
  initializeThemeData(id, name, base, themeLocation: URI): Promise<void>;
  loadCustomTokens(customTokenColors: ITokenColorizationRule[]): unknown;
}

export const IThemeStore = Symbol('IThemeStore');

export interface IThemeStore {
  getThemeData(contribution?: IThemeContribution, basePath?: URI): Promise<IThemeData>;
  getDefaultThemeID(): string;
}

export interface IThemeService {
  currentThemeId: string;
  colorThemeLoaded: Deferred<void>;
  onThemeChange: Event<ITheme>;
  registerThemes(themeContributions: IThemeContribution[], extPath: URI): IDisposable;
  ensureValidTheme(defaultThemeId?: string): Promise<string>;
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

export interface IProductIconService {
  currentThemeId: string;
  currentTheme: IProductIconTheme;
  productIconThemeLoaded: Deferred<void>;
  updateProductIconThemes(): MaybePromise<void>;
  onDidProductIconThemeChange: Event<IProductIconTheme>;
  applyTheme(themeId: string): Promise<void>;
  registerProductIconThemes(productIconThemesContribution: IThemeContribution[], extPath: URI): void;
  getAvailableThemeInfos(): IconThemeInfo[];
}

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
  HIGH_CONTRAST_DARK = 'hcDark',
  HIGH_CONTRAST_LIGHT = 'hcLight',
}

export type BuiltinTheme = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';

export function getThemeTypeName(base: BuiltinTheme) {
  const map = {
    vs: 'theme.base.vs',
    'vs-dark': 'theme.base.vs-dark',
    'hc-black': 'theme.base.hc',
    'hc-light': 'theme.base.hc',
  };
  return map[base];
}

export enum BuiltinThemeComparator {
  'vs',
  'vs-dark',
  'hc-black',
  'hc-light',
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

export const VS_LIGHT_THEME_NAME = 'vs';
export const VS_DARK_THEME_NAME = 'vs-dark';
export const HC_BLACK_THEME_NAME = 'hc-black';
export const HC_LIGHT_THEME_NAME = 'hc-light';
export interface IThemeContribution {
  id?: string;
  label: string;
  description?: string;
  // default to be vs
  uiTheme?: BuiltinTheme;
  path: string;
  extensionId: string;
}

// base themes
export const DARK: ThemeType = 'dark';
export const LIGHT: ThemeType = 'light';
export const HIGH_CONTRAST_DARK: ThemeType = 'hcDark';
export const HIGH_CONTRAST_LIGHT: ThemeType = 'hcLight';
export type ThemeType = 'light' | 'dark' | 'hcDark' | 'hcLight';

export type IconThemeType = 'light' | 'dark';

export function getBuiltinRules(builtinTheme: BuiltinTheme): IStandaloneThemeData {
  switch (builtinTheme) {
    case VS_LIGHT_THEME_NAME:
      return vs;
    case VS_DARK_THEME_NAME:
      return vs_dark;
    case HC_BLACK_THEME_NAME:
      return hc_black;
    case HC_LIGHT_THEME_NAME:
      return hc_light;
  }
}

export function getThemeTypeSelector(type: ThemeType): string {
  switch (type) {
    case DARK:
      return 'vs-dark';
    case HIGH_CONTRAST_DARK:
      return 'hc-black';
    case HIGH_CONTRAST_LIGHT:
      return 'hc-light';
    default:
      return 'vs';
  }
}

export function getThemeType(base: BuiltinTheme): ThemeType {
  switch (base) {
    case VS_LIGHT_THEME_NAME:
      return LIGHT;
    case VS_DARK_THEME_NAME:
      return DARK;
    case HC_BLACK_THEME_NAME:
      return HIGH_CONTRAST_DARK;
    case HC_LIGHT_THEME_NAME:
      return HIGH_CONTRAST_LIGHT;
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
  defaults: { light: string; dark: string; highContrast: string; highContrastLight?: string };
}

export type ColorFunction = (theme: ITheme) => Color | undefined;

export interface ColorDefaults {
  light: ColorValue | null;
  dark: ColorValue | null;
  hcDark: ColorValue | null;
  hcLight: ColorValue | null;
}

/**
 * A Color Value is either a color literal, a refence to other color or a derived color
 */
export type ColorValue = Color | string | ColorIdentifier | ColorFunction;

export interface ThemeInfo {
  name: string;
  base: BuiltinTheme;
  themeId: string;
  extensionId: string;
  inherit?: boolean;
}

export interface IconThemeInfo {
  name: string;
  themeId: string;
  extensionId: string;
}

export function themeColorFromId(id: ColorIdentifier) {
  return { id };
}

export function getThemeId(contribution: IThemeContribution) {
  if (contribution.id) {
    return contribution.id;
  }
  return `${contribution.uiTheme || 'vs-dark'} ${toCSSSelector('vscode-theme', contribution.path)}`;
}

function toCSSSelector(extensionId: string, path: string) {
  if (path.indexOf('./') === 0) {
    path = path.substring(2);
  }
  let str = `${extensionId}-${path}`;

  // remove all characters that are not allowed in css
  str = str.replace(/[^_\-a-zA-Z0-9]/g, '-');
  if (str.charAt(0).match(/[0-9\-]/)) {
    str = '_' + str;
  }
  return str;
}
