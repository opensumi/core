import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ThemeData } from './theme-data';
import { URI } from '@ali/ide-core-common';

@Injectable()
export class ThemeStore {
  private themes: Map<string, ThemeData> = new Map();

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor() {

  }

  initialize() {
    // TODO 加载插件信息
  }

  // TODO 为了调试暂时去除缓存的逻辑
  public async findThemeData(id: string, themeLocation: string) {
    let themeData = this.themes.get(id);
    // if (!themeData) {
    themeData = this.injector.get(ThemeData);
    await themeData.initializeThemeData(id, 'temp', themeLocation);
    this.themes.set(id, themeData);
    // }
    return themeData;
  }
}
