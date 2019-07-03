import { IThemeService, ThemeMix } from '../common/theme.service';
import { Autowired, INJECTOR_TOKEN, Injector, Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';
import { ThemeStore } from './theme-store';

// TODO 整个逻辑应该是：1. 从插件初始化可用主题 2. quickPick挑选主题 3. 应用主题
@Injectable()
export class ThemeService implements IThemeService {

  @Autowired()
  themeStore: ThemeStore;

  getTheme(id) {
    const themeData = this.themeStore.getThemeData(id);
    return themeData.theme;
  }

  getAvailableThemeInfos() {
    return this.themeStore.themeInfos;
  }
}
