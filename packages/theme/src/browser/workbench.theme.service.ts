import { IThemeService, ThemeServicePath, IStandaloneThemeData, ThemeMix, IColors, IColorMap, ColorContribution, ColorDefaults, ITheme, ThemeType, ColorIdentifier, getBuiltinRules } from '../common/theme.service';
import { Event, URI } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { AppConfig } from '@ali/ide-core-browser';
import { getColorRegistry } from '../common/color-registry';
import { Color } from '../common/color';

const DEFAULT_THEME_ID = 'vs-dark vscode-theme-defaults-themes-dark_plus-json';

@Injectable()
export class WorkbenchThemeService {
  @Autowired(ThemeServicePath)
  private themeService: IThemeService;

  @Autowired(AppConfig)
  private config: AppConfig;

  private colorRegistry = getColorRegistry();

  // TODO 初始化时读取本地存储配置
  private currentThemeId = DEFAULT_THEME_ID;
  private currentTheme: Theme;

  onCurrentThemeChange: Event<any>;

  constructor() {
    this.applyTheme(this.currentThemeId);
  }

  public async applyTheme(id: string) {
    const theme = await this.getTheme(id);
    // TODO themeType
    this.currentTheme = new Theme('dark', theme);
    this.currentThemeId = id;
    this.useUITheme(this.currentTheme);
  }

  // TODO dom销毁
  private useUITheme(theme: Theme) {
    const colorContributions = this.colorRegistry.getColors();
    const colors = {};
    colorContributions.forEach((contribution) => {
      const colorId = contribution.id;
      const color = theme.getColor(colorId);
      colors[colorId] = color ? color.toString() : '';
    });
    console.log(colors);
    let cssVariables = ':root{';
    for (const colorKey of Object.keys(colors)) {
      const targetColor = theme.getColor(colorKey);
      if (targetColor) {
        const hexRule = `--${colorKey.replace('.', '-')}: ${targetColor.toString()};\n`;
        cssVariables += hexRule;
      } else {
        console.warn(colorKey, '颜色未定义!');
      }
    }
    const styleNode = document.createElement('style');
    styleNode.innerHTML = cssVariables + '}';
    document.getElementsByTagName('head')[0].appendChild(styleNode);
  }

  public async getCurrentTheme() {
    if (this.currentTheme) {
      return this.currentTheme;
    } else {
      const themeData = await this.getTheme(this.currentThemeId);
      return new Theme('dark', themeData);
    }
  }

  private async getTheme(id: string): Promise<ThemeMix> {
    const theme = await this.themeService.getTheme(id);
    console.log(theme, 'get theme');
    return theme;
  }

  private async getAvailableThemeIds() {
    const themes = await this.themeService.getAvailableThemeIds();
    return themes;
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
