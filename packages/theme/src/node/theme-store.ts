import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemeData } from './theme-data';
import { URI } from '@ali/ide-core-common';
import * as path from 'path';
import { IFileService } from '@ali/ide-file-service';
import * as json5 from 'json5';
import { ThemeContribution, ThemeInfo } from '../common/theme.service';

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

  @Autowired(IFileService)
  private fileService: IFileService;

  constructor() {
    this.initialize();
  }

  async initialize() {
    // TODO 加载插件信息，主题Id和插件id关联
    const themePkgJsonPath = path.join(__dirname, '../../../../tools/theme/package.json');
    const content = await this.fileService.resolveContent(themePkgJsonPath);
    const themeConfig = json5.parse(content.content);
    const themeContributes: ThemeContribution[] = themeConfig.contributes.themes;
    for (const contribution of themeContributes) {
      const themeId = `${contribution.uiTheme} ${toCSSSelector('vscode-theme-defaults', contribution.path)}`;
      const themeLocation = path.join(path.dirname(themePkgJsonPath), contribution.path);
      const themeName = contribution.label;
      console.log(themeLocation, themeName, themeId);
      await this.initThemeData(themeId, themeName, themeLocation);
    }
    console.log('theme initialize success');
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
