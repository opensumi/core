import { ITheme, ThemeType, ColorIdentifier, getBuiltinRules, getThemeType, ThemeContribution, IColors, IColorMap, ThemeInfo, IThemeService, IThemeData, ExtColorContribution } from '../common/theme.service';
import { WithEventBus, localize, Emitter, Event } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { getColorRegistry } from '../common/color-registry';
import { Color, IThemeColor } from '../common/color';
import { ThemeChangedEvent } from '../common/event';
import { ThemeStore, getThemeId } from './theme-store';
import { Logger, getPreferenceThemeId, PreferenceService, PreferenceSchemaProvider, IPreferenceSettingsService } from '@ali/ide-core-browser';

const DEFAULT_THEME_ID = 'vs-dark vscode-theme-defaults-themes-dark_plus-json';
// from vscode
const colorIdPattern = '^\\w+[.\\w+]*$';

@Injectable()
export class WorkbenchThemeService extends WithEventBus implements IThemeService {

  private colorRegistry = getColorRegistry();

  // TODO 初始化时读取本地存储配置
  private currentThemeId;
  private currentTheme: Theme;

  private themes: Map<string, IThemeData> = new Map();
  private themeRegistry: Map<string, ThemeContribution> = new Map();

  private themeChangeEmitter: Emitter<ITheme> = new Emitter();

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

  constructor() {
    super();
    this.listen();
  }

  listen() {
    this.eventBus.on(ThemeChangedEvent, (e) => {
      this.themeChangeEmitter.fire( e.payload.theme);
    });
    this.preferenceService.onPreferenceChanged( (e) => {
      if (e.preferenceName === 'general.theme') {
        this.applyTheme(e.newValue);
      }
    });
  }

  private parseColorValue = (s: string, name: string) => {
    if (s.length > 0) {
      if (s[0] === '#') {
        return Color.Format.CSS.parseHex(s);
      } else {
        return s;
      }
    }
    this.logger.error(localize('invalid.default.colorType', '{0} must be either a color value in hex (#RRGGBB[AA] or #RGB[A]) or the identifier of a themable color which provides the default.', name));
    return Color.red;
  }

  public registerThemes(themeContributions: ThemeContribution[], extPath: string) {
    themeContributions.forEach((contribution) => {
      const themeExtContribution = Object.assign({ basePath: extPath }, contribution);
      this.themeRegistry.set(getThemeId(contribution), themeExtContribution);
      this.preferenceSchemaProvider.setSchema({
        properties: {
          'general.theme': {
            type: 'string',
            default: 'vs-dark',
            enum: this.getAvailableThemeInfos().map((info) => info.themeId),
            description: '%preference.description.general.language%',
          },
        },
      }, true);
      const map = {};
      this.getAvailableThemeInfos().forEach((info) => {
        map[info.themeId] = info.name;
      });
      this.preferenceSettings.setEnumLabels('general.theme', map);
    });
  }

  public async applyTheme(themeId: string) {
    let id = DEFAULT_THEME_ID;
    if (!themeId) {
      themeId = getPreferenceThemeId();
    }
    const existedTheme = this.getAvailableThemeInfos().find((info) => info.themeId === themeId);
    if (existedTheme) {
      id = existedTheme.id;
    } else {
      themeId = DEFAULT_THEME_ID;
    }
    if (this.currentThemeId === themeId) {
      return;
    }
    this.currentThemeId = themeId;
    const theme = await this.getTheme(id);
    const themeType = getThemeType(theme.base);
    this.currentTheme = new Theme(themeType, theme);
    this.useUITheme(this.currentTheme);
    this.eventBus.fire(new ThemeChangedEvent({
      theme: this.currentTheme,
    }));
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
      this.logger.error(localize('invalid.description', "'configuration.colors.description' must be defined and can not be empty"));
      return false;
    }
    const defaults = contribution.defaults;
    if (!defaults || typeof defaults !== 'object' || typeof defaults.light !== 'string' || typeof defaults.dark !== 'string' || typeof defaults.highContrast !== 'string') {
      this.logger.error(localize('invalid.defaults', "'configuration.colors.defaults' must be defined and must contain 'light', 'dark' and 'highContrast'"));
      return false;
    }
    return true;
  }

  // TODO 插件机制需要支持 contribution 增/减量，来做deregister
  public registerColor(contribution: ExtColorContribution) {
    if (!this.checkColorContribution(contribution)) {
      return;
    }
    const { defaults } = contribution;
    this.colorRegistry.registerColor(contribution.id, {
      light: this.parseColorValue(defaults.light, 'configuration.colors.defaults.light'),
      dark: this.parseColorValue(defaults.dark, 'configuration.colors.defaults.dark'),
      hc: this.parseColorValue(defaults.highContrast, 'configuration.colors.defaults.highContrast'),
    }, contribution.description);
  }

  public async getCurrentTheme() {
    if (this.currentTheme) {
      return this.currentTheme;
    } else {
      const themeData = await this.getTheme(this.currentThemeId);
      return new Theme(getThemeType(themeData.base), themeData);
    }
  }

  // 正常情况下请使用getCurrentTheme方法，当前主题未加载时，会使用默认的主题而不会主动激活主题
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
    const color = this.currentTheme.getColor(colorId.id);
    return color ? Color.Format.CSS.formatHexA(color) : '';
  }

  // TODO 前台缓存
  public getAvailableThemeInfos(): ThemeInfo[] {
    const themeInfos: ThemeInfo[] = [];
    for (const contribution of this.themeRegistry.values()) {
      const {
        label,
        uiTheme,
        id,
      } = contribution;
      themeInfos.push({
        id: getThemeId(contribution),
        themeId: id || getThemeId(contribution),
        name: label,
        base: uiTheme,
      });
    }
    return themeInfos;
  }

  private async getTheme(id: string): Promise<IThemeData> {
    let theme = this.themes.get(id);
    const contribution = this.themeRegistry.get(id) as ThemeContribution;
    if (!theme) {
      theme = await this.themeStore.getThemeData(contribution);
    }
    return theme;
  }

  private useUITheme(theme: Theme) {
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
  readonly themeData: IThemeData;
  private readonly colorRegistry = getColorRegistry();
  private readonly defaultColors: { [colorId: string]: Color | undefined; } = Object.create(null);

  private colorMap: IColorMap;

  constructor(type: ThemeType, themeData: IThemeData) {
    this.type = type;
    this.themeData = themeData;
    this.patchColors();
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

  // 返回主题内的颜色值
  private getColors(): IColorMap {
    if (!this.colorMap) {
      const colorMap = Object.create(null);
      // tslint:disable-next-line
      for (let id in this.themeData.colorMap) {
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

  getColor(colorId: ColorIdentifier, useDefault?: boolean): Color | undefined {
    const color = this.getColors()[colorId];
    if (color) {
      return color;
    }
    if (useDefault !== false) {
      return this.getDefault(colorId);
    }
    return undefined;
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

  defines(color: ColorIdentifier): boolean {
    if (this.themeData.colors[color]) {
      return true;
    }
    return false;
  }
}
