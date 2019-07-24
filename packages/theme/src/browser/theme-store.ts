import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemeData } from './theme-data';
import { ThemeInfo, ThemeContribution } from '../common/theme.service';
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

  public async getThemeData(contribution: ThemeContribution): Promise<ThemeData> {
    const id = getThemeId(contribution);
    if (!this.themes[id]) {
      let theme = await this.initTheme(contribution);
      if (theme) {
        return theme;
      }
      console.warn('主题初始化异常！使用默认主题信息', id);
      theme = this.injector.get(ThemeData);
      theme.initializeFromData(defaultTheme);
      return theme;
    }
    return this.themes[id] as ThemeData;
  }

}
