import { IDisposable } from '@ide-framework/ide-core-common';

export interface IExtHostTheming {
  $onColorThemeChange(themeType: string): void;
}

// tslint:disable-next-line: no-empty-interface
export interface IMainThreadTheming extends IDisposable {
}
