import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemeData } from './theme-data';
import { ThemeContribution, getThemeId } from '../common/theme.service';
import { Path } from '@ali/ide-core-common/lib/path';
import defaultTheme from './default-theme';

@Injectable()
export class ThemeStore {
  private themes: {
    [themeId: string]: ThemeData,
  } = {};

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  // TODO 支持插件安装（运行时的加载？）
  protected async initTheme(contribution: ThemeContribution, basePath: string): Promise<ThemeData> {
    const themeLocation = new Path(basePath).join(contribution.path.replace(/^\.\//, '')).toString();
    const themeName = contribution.label;
    const themeId = getThemeId(contribution);
    await this.initThemeData(themeId, themeName, themeLocation);
    return this.themes[themeId];
  }

  private async initThemeData(id: string, themeName: string, themeLocation: string) {
    let themeData = this.themes[id];
    if (!themeData) {
      themeData = this.injector.get(ThemeData);
      await themeData.initializeThemeData(id, themeName, themeLocation);
      this.themes[id] = themeData;
    }
  }

  loadDefaultTheme() {
    console.warn('没有检测到默认主题插件，使用默认主题样式！');
    const theme = this.injector.get(ThemeData);
    theme.initializeFromData(defaultTheme);
    return theme;
  }

  public async getThemeData(contribution?: ThemeContribution, basePath?: string): Promise<ThemeData> {
    // 测试情况下传入的contribution为空，加载默认主题
    if (!contribution || !basePath) {
      return this.loadDefaultTheme();
    }
    const id = getThemeId(contribution);
    if (!this.themes[id]) {
      const theme = await this.initTheme(contribution, basePath);
      if (theme) {
        // 正常加载主题
        return theme;
      }
      // 加载主题出现了未知问题
      return this.loadDefaultTheme();
    }
    // 主题有缓存
    return this.themes[id];
  }
}
