import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { IExtHostTheming, IMainThreadTheming, MainThreadAPIIdentifier } from '../../../common/vscode';
import { ColorTheme, ColorThemeKind } from '../../../common/vscode/ext-types';

export class ExtHostTheming implements IExtHostTheming {
  private _proxy: IMainThreadTheming;
  private _actual: ColorTheme;
  private _onDidChangeActiveColorTheme: Emitter<ColorTheme>;

  constructor(private rpcProtocol: IRPCProtocol) {
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadProgress);
    this._actual = new ColorTheme(ColorThemeKind.Dark);
    this._onDidChangeActiveColorTheme = new Emitter<ColorTheme>();
  }

  public get activeColorTheme(): ColorTheme {
    return this._actual;
  }

  $onColorThemeChange(type: string): void {
    const kind =
      type === 'light' ? ColorThemeKind.Light : type === 'dark' ? ColorThemeKind.Dark : ColorThemeKind.HighContrast;
    this._actual = new ColorTheme(kind);
    this._onDidChangeActiveColorTheme.fire(this._actual);
  }

  public get onDidChangeActiveColorTheme(): Event<ColorTheme> {
    return this._onDidChangeActiveColorTheme.event;
  }
}
