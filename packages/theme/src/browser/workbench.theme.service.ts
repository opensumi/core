import { ThemeMix, ITheme, ThemeType, ColorIdentifier, getBuiltinRules, getThemeType, ThemeContribution, IColors, IColorMap, ThemeInfo } from '../common/theme.service';
import { Event, WithEventBus, Domain } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { getColorRegistry } from '../common/color-registry';
import { Color, IThemeColor } from '../common/color';
import { ThemeChangedEvent } from '../common/event';
import { ThemeStore, getThemeId } from './theme-store';
import { ThemeData } from './theme-data';

const DEFAULT_THEME_ID = 'vs-dark vscode-theme-defaults-themes-dark_plus-json';

@Injectable()
export class WorkbenchThemeService extends WithEventBus {

  private colorRegistry = getColorRegistry();

  // TODO 初始化时读取本地存储配置
  private currentThemeId = DEFAULT_THEME_ID;
  private currentTheme: Theme;

  private themes: Map<string, ThemeData> = new Map();
  private themeRegistry: Map<string, ThemeContribution> = new Map();

  @Autowired()
  themeStore: ThemeStore;

  constructor() {
    super();
  }

  public registerThemes(themeContributions: ThemeContribution[], extPath: string) {
    themeContributions.forEach((contribution) => {
      const themeExtContribution = Object.assign({ basePath: extPath }, contribution);
      this.themeRegistry.set(getThemeId(contribution), themeExtContribution);
    });
  }

  public async applyTheme(id: string = this.currentThemeId) {
    const theme = await this.getTheme(id);
    const themeType = getThemeType(theme.base);
    this.currentTheme = new Theme(themeType, theme);
    this.currentThemeId = id;
    this.useUITheme(this.currentTheme);
    this.eventBus.fire(new ThemeChangedEvent({
      theme: this.currentTheme,
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
    let cssVariables = ':root{';
    for (const colorKey of Object.keys(colors)) {
      const targetColor = theme.getColor(colorKey);
      if (targetColor) {
        const hexRule = `--${colorKey.replace('.', '-')}: ${targetColor.toString()};\n`;
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

  public async getCurrentTheme() {
    if (this.currentTheme) {
      return this.currentTheme;
    } else {
      const themeData = await this.getTheme(this.currentThemeId);
      return new Theme(getThemeType(themeData.base), themeData);
    }
  }

  public getCurrentThemeSync() {
    return this.currentTheme;
  }

  private async getTheme(id: string): Promise<ThemeData> {
    let theme = this.themes.get(id);
    const contribution = this.themeRegistry.get(id) as ThemeContribution;
    if (!theme) {
      theme = await this.themeStore.getThemeData(contribution);
    }
    return theme;
  }

  public getColor(color: string | IThemeColor | undefined): string | undefined {
    if (!color) {
      return undefined;
    }
    if (typeof color === 'string') {
      return color;
    }
    return this.currentTheme.getColor(color.id)!.toString();
  }

  // TODO 前台缓存
  public async getAvailableThemeInfos(): Promise<ThemeInfo[]> {
    const themeInfos: ThemeInfo[] = [];
    for (const contribution of this.themeRegistry.values()) {
      const {
        label,
        uiTheme,
      } = contribution;
      themeInfos.push({
        id: getThemeId(contribution),
        name: label,
        base: uiTheme,
      });
    }
    return themeInfos;
  }
}

export class Themable extends WithEventBus {
  @Autowired()
  themeService: WorkbenchThemeService;

  protected theme: ITheme;

  constructor() {
    super();
    this.listenThemeChange();
  }

  // 传入色值ID，主题色未定义时，若useDefault为false则返回undefined
  protected async getColor(id: ColorIdentifier, useDefault?: boolean) {
    if (!this.theme) {
      this.theme = await this.themeService.getCurrentTheme();
    }
    return this.theme.getColor(id, useDefault);
  }

  private listenThemeChange() {
    this.eventBus.on(ThemeChangedEvent, (e) => {
      this.theme = e.payload.theme;
      this.style();
      if (this.onThemeChange) {
        this.onThemeChange(this.theme);
      }
    });
  }

  onThemeChange?(theme: ITheme): void {
    // update
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
  private readonly defaultColors: { [colorId: string]: Color | undefined; } = Object.create(null);

  private colorMap: IColorMap;

  constructor(type: ThemeType, themeData: ThemeData) {
    this.type = type;
    this.themeData = themeData;
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
