import { Autowired, Injectable } from '@opensumi/di';
import {
  Logger,
  PreferenceService,
  PreferenceSchemaProvider,
  IPreferenceSettingsService,
} from '@opensumi/ide-core-browser';
import {
  Event,
  URI,
  WithEventBus,
  localize,
  Emitter,
  isObject,
  DisposableCollection,
  uuid,
  isLinux,
  isWindows,
  IThemeColor,
  OnEvent,
  ExtensionDidContributes,
} from '@opensumi/ide-core-common';

import { ICSSStyleService } from '../common';
import { Color } from '../common/color';
import { getColorRegistry } from '../common/color-registry';
import { ThemeChangedEvent } from '../common/event';
import {
  ITheme,
  ThemeType,
  ColorIdentifier,
  getBuiltinRules,
  getThemeType,
  ThemeContribution,
  IColorMap,
  ThemeInfo,
  IThemeService,
  ExtColorContribution,
  getThemeId,
  getThemeTypeSelector,
  IColorCustomizations,
  ITokenColorizationRule,
  ITokenColorCustomizations,
  DEFAULT_THEME_ID,
  colorIdPattern,
} from '../common/theme.service';


import { ThemeData } from './theme-data';
import { ThemeStore } from './theme-store';


export const CUSTOM_WORKBENCH_COLORS_SETTING = 'workbench.colorCustomizations';
export const CUSTOM_EDITOR_COLORS_SETTING = 'editor.tokenColorCustomizations';
export const COLOR_THEME_SETTING = 'general.theme';

const tokenGroupToScopesMap = {
  comments: ['comment', 'punctuation.definition.comment'],
  strings: ['string', 'meta.embedded.assembly'],
  keywords: ['keyword - keyword.operator', 'keyword.control', 'storage', 'storage.type'],
  numbers: ['constant.numeric'],
  types: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
  functions: ['entity.name.function', 'support.function'],
  variables: ['variable', 'entity.name.variable'],
};

@Injectable()
export class WorkbenchThemeService extends WithEventBus implements IThemeService {
  private colorRegistry = getColorRegistry();

  private colorClassNameMap = new Map<string, string>();

  public currentThemeId: string;
  private currentTheme?: Theme;

  private themes: Map<string, ThemeData> = new Map();
  private themeContributionRegistry: Map<string, { contribution: ThemeContribution; basePath: URI }> = new Map();

  private themeChangeEmitter: Emitter<ITheme> = new Emitter();
  protected extensionReady: boolean;

  public onThemeChange: Event<ITheme> = this.themeChangeEmitter.event;

  @Autowired()
  private themeStore: ThemeStore;

  @Autowired()
  private logger: Logger;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(PreferenceSchemaProvider)
  private preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IPreferenceSettingsService)
  private preferenceSettings: IPreferenceSettingsService;

  @Autowired(ICSSStyleService)
  private readonly styleService: ICSSStyleService;

  constructor() {
    super();
    this.listen();
    this.applyPlatformClass();
  }

  @OnEvent(ExtensionDidContributes)
  onDidExtensionContributes() {
    const themeMap = this.getAvailableThemeInfos().reduce((pre: Map<string, string>, cur: ThemeInfo) => {
      if (!pre.has(cur.themeId)) {
        pre.set(cur.themeId, cur.name);
      }
      return pre;
    }, new Map());

    const themeId = this.preferenceService.get<string>(COLOR_THEME_SETTING);
    if (themeId && themeId !== DEFAULT_THEME_ID && themeMap.has(themeId)) {
      this.applyTheme(themeId);
    } else {
      this.applyTheme(DEFAULT_THEME_ID);
    }

    this.preferenceSettings.setEnumLabels(COLOR_THEME_SETTING, Object.fromEntries(themeMap.entries()));
  }

  public registerThemes(themeContributions: ThemeContribution[], extPath: URI) {
    const disposables = new DisposableCollection();
    disposables.push({
      dispose: () => this.doSetPreferenceSchema(),
    });
    const preferenceThemeId = this.preferenceService.get<string>(COLOR_THEME_SETTING);

    themeContributions.forEach((contribution) => {
      const themeExtContribution = { basePath: extPath, contribution };
      const themeId = getThemeId(contribution);

      this.themeContributionRegistry.set(themeId, themeExtContribution);

      if (preferenceThemeId === themeId) {
        this.applyTheme(preferenceThemeId);
      }

      disposables.push({
        dispose: () => {
          this.themeContributionRegistry.delete(themeId);
        },
      });

      disposables.push({
        dispose: () => {
          if (this.currentThemeId === themeId) {
            this.applyTheme(DEFAULT_THEME_ID);
          }
        },
      });
    });

    this.doSetPreferenceSchema();

    return disposables;
  }

  public async applyTheme(themeId: string) {
    if (this.currentThemeId === themeId) {
      return;
    }

    const prevThemeType = this.currentTheme ? this.currentTheme.type : 'dark';
    this.currentThemeId = themeId;

    const theme = await this.getTheme(themeId);
    const themeType = getThemeType(theme.base);

    this.currentTheme = new Theme(themeType, theme);
    this.currentTheme.setCustomColors(this.colorCustomizations);
    this.currentTheme.setCustomTokenColors(this.tokenColorCustomizations);

    const currentThemeType = this.currentTheme.type;

    this.toggleBaseThemeClass(prevThemeType, currentThemeType);

    this.doApplyTheme(this.currentTheme);
  }

  public registerColor(contribution: ExtColorContribution) {
    if (!this.checkColorContribution(contribution)) {
      return;
    }
    const { defaults } = contribution;
    this.colorRegistry.registerColor(
      contribution.id,
      {
        light: this.parseColorValue(defaults.light, 'configuration.colors.defaults.light'),
        dark: this.parseColorValue(defaults.dark, 'configuration.colors.defaults.dark'),
        hc: this.parseColorValue(defaults.highContrast, 'configuration.colors.defaults.highContrast'),
      },
      contribution.description,
    );
  }

  // @deprecated 请直接使用sync方法，主题加载由时序保障
  public async getCurrentTheme() {
    if (this.currentTheme) {
      return this.currentTheme;
    } else {
      const themeData = await this.getTheme(this.currentThemeId);
      return new Theme(getThemeType(themeData.base), themeData);
    }
  }

  public getCurrentThemeSync() {
    if (this.currentTheme) {
      return this.currentTheme;
    } else {
      const themeData = this.themeStore.loadDefaultTheme();
      return new Theme(getThemeType(themeData.base), themeData);
    }
  }

  public getColor(colorId: string | IThemeColor | undefined): string | undefined {
    if (!colorId) {
      return undefined;
    }
    if (typeof colorId === 'string') {
      return colorId;
    }
    const color = this.currentTheme?.getColor(colorId.id);
    return color ? Color.Format.CSS.formatHexA(color) : '';
  }

  // 将 colorId 转换成 css 变量
  public getColorVar(colorId: string | IThemeColor | undefined): string | undefined {
    if (!colorId) {
      return undefined;
    }
    if (typeof colorId === 'string') {
      return colorId;
    }
    const colorKey = colorId.id;
    return colorKey ? `var(--${colorKey.replace(/\./g, '-')})` : undefined;
  }

  public getColorClassNameByColorToken(colorId: string | IThemeColor): string | undefined {
    if (!colorId) {
      return undefined;
    }
    const id = typeof colorId === 'string' ? colorId : colorId.id;
    if (this.colorClassNameMap.has(id)) {
      return this.colorClassNameMap.get(id)!;
    }
    const className = `color-token-${uuid()}`;
    this.styleService.addClass(className, {
      color: this.getColorVar({ id })!,
    });
    this.colorClassNameMap.set(id, className);
    return className;
  }

  public getAvailableThemeInfos(): ThemeInfo[] {
    const themeInfos: ThemeInfo[] = [];
    for (const { contribution } of this.themeContributionRegistry.values()) {
      const { label, uiTheme } = contribution;
      themeInfos.push({
        themeId: getThemeId(contribution),
        name: label,
        base: uiTheme || 'vs',
      });
    }
    return themeInfos;
  }

  protected doSetPreferenceSchema() {
    this.preferenceSchemaProvider.setSchema(
      {
        properties: {
          [COLOR_THEME_SETTING]: {
            type: 'string',
            default: 'Default Dark+',
            enum: this.getAvailableThemeInfos().map((info) => info.themeId),
          },
        },
      },
      true,
    );
  }

  private get colorCustomizations(): IColorCustomizations {
    return this.preferenceService.get(CUSTOM_WORKBENCH_COLORS_SETTING) || {};
  }

  private get tokenColorCustomizations(): ITokenColorCustomizations {
    return this.preferenceService.get<ITokenColorCustomizations>(CUSTOM_EDITOR_COLORS_SETTING) || {};
  }

  private listen() {
    this.addDispose(
      this.eventBus.on(ThemeChangedEvent, (e) => {
        this.themeChangeEmitter.fire(e.payload.theme);
      }),
    );

    this.addDispose(
      Event.debounce(
        this.preferenceService.onPreferenceChanged,
        (_, e) => e,
        50,
      )(async (e) => {
        if (e.preferenceName === COLOR_THEME_SETTING) {
          await this.applyTheme(e.newValue);
        }

        if (this.currentTheme) {
          switch (e.preferenceName) {
            case CUSTOM_WORKBENCH_COLORS_SETTING: {
              this.currentTheme.setCustomColors(e.newValue);
              this.doApplyTheme(this.currentTheme);
              break;
            }
            case CUSTOM_EDITOR_COLORS_SETTING: {
              this.currentTheme.setCustomTokenColors(e.newValue);
              this.eventBus.fire(
                new ThemeChangedEvent({
                  theme: this.currentTheme,
                }),
              );
              break;
            }
            default:
              break;
          }
        }
      }),
    );

    this.addDispose(
      this.colorRegistry.onDidColorChangedEvent((e) => {
        if (this.currentTheme) {
          this.doApplyTheme.apply(this, [this.currentTheme]);
        }
      }),
    );
  }

  private checkColorContribution(contribution: ExtColorContribution) {
    if (typeof contribution.id !== 'string' || contribution.id.length === 0) {
      this.logger.error(localize('invalid.id', "'configuration.colors.id' must be defined and can not be empty"));
      return false;
    }
    if (!contribution.id.match(colorIdPattern)) {
      this.logger.error(localize('invalid.id.format', "'configuration.colors.id' must follow the word[.word]*"));
      return false;
    }
    if (typeof contribution.description !== 'string' || contribution.id.length === 0) {
      this.logger.error(
        localize('invalid.description', "'configuration.colors.description' must be defined and can not be empty"),
      );
      return false;
    }
    const defaults = contribution.defaults;
    if (
      !defaults ||
      typeof defaults !== 'object' ||
      typeof defaults.light !== 'string' ||
      typeof defaults.dark !== 'string' ||
      typeof defaults.highContrast !== 'string'
    ) {
      this.logger.error(
        localize(
          'invalid.defaults',
          "'configuration.colors.defaults' must be defined and must contain 'light', 'dark' and 'highContrast'",
        ),
      );
      return false;
    }
    return true;
  }

  private parseColorValue = (s: string, name: string) => {
    if (s.length > 0) {
      if (s[0] === '#') {
        return Color.Format.CSS.parseHex(s);
      } else {
        return s;
      }
    }
    this.logger.error(
      localize(
        'invalid.default.colorType',
        '{0} must be either a color value in hex (#RRGGBB[AA] or #RGB[A]) or the identifier of a themable color which provides the default.',
        name,
      ),
    );
    return Color.red;
  };

  private async getTheme(id: string): Promise<ThemeData> {
    const theme = this.themes.get(id);
    if (theme) {
      return theme;
    }
    const themeInfo = this.themeContributionRegistry.get(id);
    if (themeInfo) {
      const { contribution, basePath } = themeInfo;
      return await this.themeStore.getThemeData(contribution, basePath);
    }
    return await this.themeStore.getThemeData();
  }

  private doApplyTheme(theme: Theme) {
    const colorContributions = this.colorRegistry.getColors();
    const colors = {};
    colorContributions.forEach((contribution) => {
      const colorId = contribution.id;
      const color = theme.getColor(colorId);
      colors[colorId] = color ? color.toString() : '';
    });
    // 添加一些额外计算出的颜色
    const foreground = theme.getColor('foreground');
    if (foreground) {
      colors['foreground.secondary'] = foreground.darken(0.2).toString();
    }
    if (theme.getColor('menu.foreground')) {
      colors['menu.foreground.disabled'] = theme.getColor('menu.foreground')!.darken(0.4).toString();
    }

    let cssVariables = ':root{';
    for (const colorKey of Object.keys(colors)) {
      const targetColor = colors[colorKey] || theme.getColor(colorKey);
      if (targetColor) {
        const hexRule = `--${colorKey.replace(/\./g, '-')}: ${targetColor.toString()};\n`;
        cssVariables += hexRule;
      }
    }
    let styleNode = document.getElementById('theme-style');
    if (styleNode) {
      styleNode.innerHTML = cssVariables + '}';
    } else {
      styleNode = document.createElement('style');
      styleNode.id = 'theme-style';
      styleNode.innerHTML = cssVariables + '}';
      document.getElementsByTagName('head')[0].appendChild(styleNode);
    }
    if (this.currentTheme) {
      this.eventBus.fire(
        new ThemeChangedEvent({
          theme: this.currentTheme,
        }),
      );
    }
  }

  protected toggleBaseThemeClass(prevThemeType: ThemeType, themeType: ThemeType) {
    const htmlNode = document.getElementsByTagName('html')[0];
    htmlNode.classList.remove(getThemeTypeSelector(prevThemeType));
    htmlNode.classList.add(getThemeTypeSelector(themeType));
  }

  protected applyPlatformClass() {
    const platformClass = isWindows ? 'windows' : isLinux ? 'linux' : 'mac';
    const rootNode = document.getElementsByTagName('body')[0]!;
    rootNode.classList.add(platformClass);
  }
}

export class Themable extends WithEventBus {
  @Autowired(IThemeService)
  themeService: WorkbenchThemeService;

  protected theme: ITheme;

  constructor() {
    super();
    this.listenThemeChange();
  }

  get currentTheme() {
    return this.theme;
  }

  // 传入色值ID，主题色未定义时，若useDefault为false则返回undefined
  protected async getColor(id: ColorIdentifier, useDefault?: boolean) {
    if (!this.theme) {
      this.theme = await this.themeService.getCurrentTheme();
    }
    return this.theme.getColor(id, useDefault);
  }

  protected getColorSync(id: ColorIdentifier, useDefault?: boolean) {
    if (!this.theme) {
      this.theme = this.themeService.getCurrentThemeSync();
    }
    return this.theme.getColor(id, useDefault);
  }

  private listenThemeChange() {
    this.themeService.onThemeChange((theme) => {
      this.theme = theme;
      this.style();
    });
  }

  // themeChange时自动调用，首次调用时机需要模块自己判断
  async style(): Promise<void> {
    // use theme
  }
}

class Theme implements ITheme {
  readonly type: ThemeType;
  readonly themeData: ThemeData;
  private readonly colorRegistry = getColorRegistry();
  private readonly defaultColors: { [colorId: string]: Color | undefined } = Object.create(null);

  private colorMap: IColorMap;
  private customColorMap: IColorMap = {};
  private customTokenColors: ITokenColorizationRule[] = [];

  constructor(type: ThemeType, themeData: ThemeData) {
    this.type = type;
    this.themeData = themeData;
    this.patchColors();
    this.patchTokenColors();
    this.themeData.loadCustomTokens(this.customTokenColors);
  }

  getColor(colorId: ColorIdentifier, useDefault?: boolean): Color | undefined {
    const color = this.customColorMap[colorId] || this.getColors()[colorId];
    if (color) {
      return color;
    }
    if (useDefault !== false) {
      return this.getDefault(colorId);
    }
    return undefined;
  }

  defines(color: ColorIdentifier): boolean {
    if (this.customColorMap[color] || this.themeData.colors[color]) {
      return true;
    }
    return false;
  }

  setCustomColors(colors: IColorCustomizations) {
    this.customColorMap = {};
    this.overwriteCustomColors(colors);

    const themeSpecificColors = colors[`[${this.themeData.name}]`] as IColorCustomizations;
    if (isObject(themeSpecificColors)) {
      this.overwriteCustomColors(themeSpecificColors);
    }
  }

  setCustomTokenColors(customTokenColors: ITokenColorCustomizations) {
    this.customTokenColors = [];

    // first add the non-theme specific settings
    this.addCustomTokenColors(customTokenColors);

    // append theme specific settings. Last rules will win.
    const themeSpecificTokenColors = customTokenColors[`[${this.themeData.name}]`] as ITokenColorCustomizations;
    if (isObject(themeSpecificTokenColors)) {
      this.addCustomTokenColors(themeSpecificTokenColors);
    }
    this.themeData.loadCustomTokens(this.customTokenColors);
  }

  private addCustomTokenColors(customTokenColors: ITokenColorCustomizations) {
    // Put the general customizations such as comments, strings, etc. first so that
    // they can be overridden by specific customizations like "string.interpolated"
    // eslint-disable-next-line guard-for-in
    for (const tokenGroup in tokenGroupToScopesMap) {
      const group = tokenGroup as keyof typeof tokenGroupToScopesMap; // TS doesn't type 'tokenGroup' properly
      const value = customTokenColors[group];
      if (value) {
        const settings = typeof value === 'string' ? { foreground: value } : value;
        const scopes = tokenGroupToScopesMap[group];
        for (const scope of scopes) {
          this.customTokenColors.push({ scope, settings });
        }
      }
    }

    // specific customizations
    if (Array.isArray(customTokenColors.textMateRules)) {
      for (const rule of customTokenColors.textMateRules) {
        if (rule.scope && rule.settings) {
          this.customTokenColors.push(rule);
        }
      }
    }
  }

  private overwriteCustomColors(colors: IColorCustomizations) {
    // eslint-disable-next-line guard-for-in
    for (const id in colors) {
      const colorVal = colors[id];
      if (typeof colorVal === 'string') {
        this.customColorMap[id] = Color.fromHex(colorVal);
      }
    }
  }

  protected patchColors() {
    const colorContributions = this.colorRegistry.getColors();
    for (const colorContribution of colorContributions) {
      const id = colorContribution.id;
      const colorMap = this.themeData.colorMap;
      if (!colorMap[id]) {
        const color = this.colorRegistry.resolveDefaultColor(id, this);
        if (color) {
          colorMap[id] = color;
          this.themeData.colors[id] = Color.Format.CSS.formatHexA(color);
        }
      }
    }
  }

  // 将encodedTokensColors转为monaco可用的形式
  private patchTokenColors() {
    // 当默认颜色不在settings当中时，此处不能使用之前那种直接给encodedTokenColors赋值的做法，会导致monaco使用时颜色错位（theia的bug
    if (this.themeData.themeSettings.filter((setting) => !setting.scope).length === 0) {
      this.themeData.themeSettings.unshift({
        settings: {
          foreground: this.themeData.colors['editor.foreground']
            ? this.themeData.colors['editor.foreground'].substr(0, 7)
            : Color.Format.CSS.formatHexA(this.colorRegistry.resolveDefaultColor('editor.foreground', this)!), // 这里要去掉透明度信息
          background: this.themeData.colors['editor.background']
            ? this.themeData.colors['editor.background'].substr(0, 7)
            : Color.Format.CSS.formatHexA(this.colorRegistry.resolveDefaultColor('editor.background', this)!),
        },
      });
    }
  }

  // 返回主题内的颜色值
  private getColors(): IColorMap {
    if (!this.colorMap) {
      const colorMap = Object.create(null);
      // eslint-disable-next-line guard-for-in
      for (const id in this.themeData.colorMap) {
        colorMap[id] = this.themeData.colorMap[id];
      }
      if (this.themeData.inherit) {
        const baseData = getBuiltinRules(this.themeData.base);
        for (const id in baseData.colors) {
          if (!colorMap[id]) {
            colorMap[id] = Color.fromHex(baseData.colors[id]);
          }
        }
      }
      this.colorMap = colorMap;
    }
    return this.colorMap;
  }

  private getDefault(colorId: ColorIdentifier): Color | undefined {
    let color = this.defaultColors[colorId];
    if (color) {
      return color;
    }
    color = this.colorRegistry.resolveDefaultColor(colorId, this);
    this.defaultColors[colorId] = color;
    return color;
  }
}
