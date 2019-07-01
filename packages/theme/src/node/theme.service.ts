import { IThemeService } from '../common/theme.service';
import { Autowired, INJECTOR_TOKEN, Injector, Injectable } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';
import { ThemeStore } from './theme-store';

@Injectable()
export class ThemeService implements IThemeService {

  @Autowired()
  themeStore: ThemeStore;

  async getTheme(themeLocation: string) {
    const themeData = await this.themeStore.findThemeData('vs-dark', themeLocation);
    return themeData.result;
  }
}
