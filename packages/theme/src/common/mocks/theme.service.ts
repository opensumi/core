import { Injectable } from '@opensumi/di';
import { Emitter, Event, URI, IThemeColor, Deferred } from '@opensumi/ide-core-common';

import { ThemeContribution, ExtColorContribution, IThemeService, ITheme } from '../theme.service';

@Injectable()
export class MockThemeService implements IThemeService {
  colorThemeLoaded: Deferred<void>;

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
    this.colorThemeLoaded.resolve();
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
