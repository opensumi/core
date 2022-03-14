import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { URI, getDebugLogger } from '@opensumi/ide-core-common';

import { ThemeContribution, getThemeId } from '../common/theme.service';

import defaultTheme from './default-theme';
import { ThemeData } from './theme-data';

@Injectable()
export class ThemeStore {
  static STORE_THEME_DATA_KEY = 'latestTheme';

  private themes: {
    [themeId: string]: ThemeData;
  } = {};

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  protected async initTheme(contribution: ThemeContribution, extPath: URI): Promise<ThemeData> {
    const themePath = contribution.path.replace(/^\.\//, '');
    const themeLocation = extPath.resolve(themePath);
    const themeName = contribution.label;
    const themeId = getThemeId(contribution);
    const themeBase = contribution.uiTheme || 'vs-dark';
    await this.initThemeData(themeId, themeName, themeBase, themeLocation);
    return this.themes[themeId];
  }

  private async initThemeData(id: string, themeName: string, themeBase: string, themeLocation: URI) {
    let themeData = this.themes[id];
    if (!themeData) {
      themeData = this.injector.get(ThemeData);
      await themeData.initializeThemeData(id, themeName, themeBase, themeLocation);
      this.themes[id] = themeData;
    }
  }

  loadDefaultTheme() {
    getDebugLogger().warn('The default theme extension is not detected, and the default theme style is used.');
    const theme = this.injector.get(ThemeData);
    theme.initializeFromData(defaultTheme);
    return theme;
  }

  private async tryLoadLatestTheme() {
    // 尝试使用最近一次缓存的主题信息进行加载
    const themeData = this.getLatestThemeData();
    if (themeData) {
      try {
        const { contribution, basePath } = themeData;
        const theme = await this.initTheme(contribution, new URI(basePath));
        return theme;
      } catch (e) {
        // 主题不存在或被卸载时，移除缓存，使用默认样式
        localStorage.removeItem(ThemeStore.STORE_THEME_DATA_KEY);
      }
    }
    return this.loadDefaultTheme();
  }

  private storeLatestThemeData(contribution?: ThemeContribution, basePath?: URI) {
    localStorage.setItem(
      ThemeStore.STORE_THEME_DATA_KEY,
      JSON.stringify({ contribution, basePath: basePath?.toString() }),
    );
  }

  private getLatestThemeData() {
    const data = localStorage.getItem(ThemeStore.STORE_THEME_DATA_KEY);
    if (data) {
      return JSON.parse(data);
    }
  }

  public async getThemeData(contribution?: ThemeContribution, basePath?: URI): Promise<ThemeData> {
    // 测试情况下传入的contribution为空，尝试加载上次缓存的最新主题
    if (!contribution || !basePath) {
      return await this.tryLoadLatestTheme();
    }
    const id = getThemeId(contribution);
    if (!this.themes[id]) {
      const theme = await this.initTheme(contribution, basePath);
      if (theme) {
        // 正常加载主题
        this.storeLatestThemeData(contribution, basePath);
        return theme;
      }
      // 加载主题出现了未知问题, 使用默认主题配色
      return this.loadDefaultTheme();
    }
    // 主题有缓存
    return this.themes[id];
  }
}
