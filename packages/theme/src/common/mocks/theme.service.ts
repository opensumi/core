import { ThemeContribution, ExtColorContribution, IThemeService, ITheme } from '../theme.service';
import { IThemeColor } from '../color';
import { Injectable } from '@ali/common-di';
import { Emitter } from '@ali/ide-core-common';

@Injectable()
export class MockThemeService implements IThemeService {
  public currentThemeId = 'dark';

  private _onThemeChange = new Emitter<ITheme>();

  get onThemeChange() {
    return this._onThemeChange.event;
  }

  registerThemes(themeContributions: ThemeContribution[], extPath: string) {
    return {
      dispose: () => {},
    };
  }
  async applyTheme(id?: string) {
    throw new Error('Method not implemented.');
  }

  getAvailableThemeInfos() {
    return [];
  }

  async getCurrentTheme() {
    return {} as ITheme;
  }

  getCurrentThemeSync() {
    return {} as ITheme;
  }

  getColor(id: string | IThemeColor | undefined) {
    return '';
  }

  getColorVar(id: string | IThemeColor | undefined) {
    return '';
  }

  registerColor(contribution: ExtColorContribution) {
    throw new Error('Method not implemented.');
  }
}
