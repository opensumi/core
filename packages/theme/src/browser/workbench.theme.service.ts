import { IThemeService, ThemeServicePath, IStandaloneThemeData, ThemeMix, IColors, IColorMap, ColorContribution, ColorDefaults, ITheme, ThemeType, ColorIdentifier, getBuiltinRules, getThemeType } from '../common/theme.service';
import { Event, WithEventBus } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { getColorRegistry } from '../common/color-registry';
import { Color } from '../common/color';
import { ThemeChangedEvent } from '../common/event';

const DEFAULT_THEME_ID = 'vs-dark vscode-theme-defaults-themes-dark_plus-json';

@Injectable()
export class WorkbenchThemeService extends WithEventBus {
  @Autowired(ThemeServicePath)
  private themeService: IThemeService;

  private colorRegistry = getColorRegistry();

  // TODO 初始化时读取本地存储配置
  private currentThemeId = DEFAULT_THEME_ID;
  private currentTheme: Theme;

  private themes: Map<string, ThemeMix> = new Map();

  onCurrentThemeChange: Event<any>;

  constructor() {
    super();
    this.applyTheme(this.currentThemeId);
  }

  public async applyTheme(id: string) {
    const theme = await this.getTheme(id);
    const themeType = getThemeType(theme.base);
    this.currentTheme = new Theme(themeType, theme);
    this.currentThemeId = id;
    this.useUITheme(this.currentTheme);
    this.eventBus.fire(new ThemeChangedEvent({
      themeData: theme,
    }));
  }

  private useUITheme(theme: Theme) {
    const colorContributions = this.colorRegistry.getColors();
    const colors = {};
    colorContributions.forEach((contribution) => {
      const colorId = contribution.id;
      const color = theme.getColor(colorId);
      colors[colorId] = color ? color.toString() : '';
    });
    console.log('apply new ui colors: ', colors);
    let cssVariables = ':root{';
    for (const colorKey of Object.keys(colors)) {
      const targetColor = theme.getColor(colorKey);
      if (targetColor) {
        const hexRule = `--${colorKey.replace('.', '-')}: ${targetColor.toString()};\n`;
        cssVariables += hexRule;
      } else {
        // TODO 这部分默认就未定义的颜色怎么办？
        // console.warn(colorKey, '颜色未定义!');
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

  public async getCurrentTheme() {
    if (this.currentTheme) {
      return this.currentTheme;
    } else {
      const themeData = await this.getTheme(this.currentThemeId);
      return new Theme(getThemeType(themeData.base), themeData);
    }
  }

  private async getTheme(id: string): Promise<ThemeMix> {
    let theme = this.themes.get(id);
    if (!theme) {
      theme = await this.themeService.getTheme(id);
    }
    return theme;
  }

  // TODO 前台缓存
  public async getAvailableThemeInfos() {
    const themeInfos = await this.themeService.getAvailableThemeInfos();
    return themeInfos;
  }
}

class Theme implements ITheme {
  readonly type: ThemeType;
  readonly themeData: ThemeMix;
  private readonly colorRegistry = getColorRegistry();
  private readonly defaultColors: { [colorId: string]: Color | undefined; } = Object.create(null);

  private colors: { [colorId: string]: Color } | null;

  constructor(type, themeData) {
    this.type = type;
    this.themeData = themeData;
  }

  // 返回主题内的颜色值
  private getColors(): { [colorId: string]: Color } {
    if (!this.colors) {
      const colors: { [colorId: string]: Color } = Object.create(null);
      // tslint:disable-next-line
      for (let id in this.themeData.colors) {
        colors[id] = Color.fromHex(this.themeData.colors[id]);
      }
      if (this.themeData.inherit) {
        const baseData = getBuiltinRules(this.themeData.base);
        for (const id in baseData.colors) {
          if (!colors[id]) {
            colors[id] = Color.fromHex(baseData.colors[id]);
          }

        }
      }
      this.colors = colors;
    }
    return this.colors;
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
