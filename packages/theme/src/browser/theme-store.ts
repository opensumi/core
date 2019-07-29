import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemeData } from './theme-data';
import { ThemeContribution, IThemeData } from '../common/theme.service';
import { Path } from '@ali/ide-core-common/lib/path';
import defaultTheme from './default';

export interface ThemeExtContribution extends ThemeContribution {
  basePath: string;
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

export function getThemeId(contribution: ThemeContribution) {
  return `${contribution.uiTheme} ${toCSSSelector('vscode-theme-defaults', contribution.path)}`;
}

@Injectable()
export class ThemeStore {
  private themes: {
    [themeId: string]: ThemeData,
  } = {};

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  // TODO 支持插件安装（运行时的加载？）
  async initTheme(contribution): Promise<ThemeData> {
    const themeLocation = new Path(contribution.basePath).join(contribution.path.replace(/^\.\//, '')).toString();
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
    const theme = this.injector.get(ThemeData);
    theme.initializeFromData(defaultTheme);
    return theme;
  }

  public async getThemeData(contribution: ThemeContribution): Promise<IThemeData> {
    // 测试情况下传入的contribution为空，加载默认主题
    if (!contribution) {
      return this.loadDefaultTheme();
    }
    const id = getThemeId(contribution);
    if (!this.themes[id]) {
      const theme = await this.initTheme(contribution);
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
