import { Event } from '@ali/ide-core-common';

export interface IThemeService {
  onCurrentThemeChange: Event<any>;

  getTheme(): any;
}
