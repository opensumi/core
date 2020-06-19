import { ThemeContribution, ExtColorContribution, IThemeService, ITheme, IThemeColor } from '@ali/ide-theme';
import { Injectable } from '@ali/common-di';
import { Emitter, URI } from '@ali/ide-core-common';

@Injectable()
export class MockThemeService implements IThemeService {
  public currentThemeId = 'dark';

  private _onThemeChange = new Emitter<ITheme>();

  get onThemeChange() {
    return this._onThemeChange.event;
  }

  registerThemes(themeContributions: ThemeContribution[], extPath: URI) {
    throw new Error('Method not implemented.');
  }
  async applyTheme(id?: string) {
    throw new Error('Method not implemented.');
  }

  getAvailableThemeInfos() {
    return [];
  }

  async getCurrentTheme() {
    return {themeData: {name: 'test', base: 'vs-dark', id: 'xxxxx'}} as ITheme;
  }

  getCurrentThemeSync() {
    return {themeData: {name: 'test', base: 'vs-dark', id: 'xxxxx'}} as ITheme;
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
