import { Injectable } from '@opensumi/di';
import { Emitter, Event, URI, IThemeColor } from '@opensumi/ide-core-common';

import { ThemeContribution, ExtColorContribution, IThemeService, ITheme } from '../theme.service';

@Injectable()
export class MockThemeService implements IThemeService {
  public currentThemeId = 'dark';

  private _onThemeChange = new Emitter<ITheme>();

  get onThemeChange(): Event<ITheme> {
    return this._onThemeChange.event;
  }

  registerThemes(themeContributions: ThemeContribution[], extPath: URI) {
    return {
      dispose: () => {},
    };
  }
  async applyTheme(id: string) {
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

  getColorClassNameByColorToken(colorId: string | IThemeColor): string {
    throw new Error('Method not implemented.');
  }
}
