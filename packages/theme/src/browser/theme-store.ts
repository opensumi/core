import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemeData } from './theme-data';
import { ThemeInfo, ThemeContribution } from '../common/theme.service';
import { AppConfig } from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';

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

@Injectable()
export class ThemeStore {
  private themes: {
    [themeId: string]: ThemeData,
  } = {};

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(AppConfig)
  private config: AppConfig;

  // TODO 支持插件安装（运行时的加载？）
  async initTheme(contribution) {
    const themeId = `${contribution.uiTheme} ${toCSSSelector('vscode-theme-defaults', contribution.path)}`;
    // TODO 主题信息缓存逻辑
    if (this.themes[themeId]) {
      return;
    }
    const themeLocation = new Path(contribution.basePath).join(contribution.path.replace(/^\.\//, '')).toString();
    const themeName = contribution.label;
    console.log(themeLocation, themeName, themeId);
    await this.initThemeData(themeId, themeName, themeLocation);
  }

  private async initThemeData(id: string, themeName: string, themeLocation: string) {
    let themeData = this.themes[id];
    if (!themeData) {
      themeData = this.injector.get(ThemeData);
      await themeData.initializeThemeData(id, themeName, themeLocation);
      this.themes[id] = themeData;
    }
  }

  // TODO 主题还未加载时，
  public getThemeData(id: string) {
    if (!this.themes[id]) {
      console.error('主题还未准备好！TODO：主动激活主题插件', id);
    }
    return this.themes[id] as ThemeData;
  }

  get themeInfos(): ThemeInfo[] {
    const themeInfos: ThemeInfo[] = [];
    for (const themeId of Object.keys(this.themes)) {
      const {
        id,
        name,
        base,
        inherit,
      } = this.themes[themeId];
      themeInfos.push({
        id,
        name,
        base,
        inherit,
      });
    }
    return themeInfos;
  }
}
