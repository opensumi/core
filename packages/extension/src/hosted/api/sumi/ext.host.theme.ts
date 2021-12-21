import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter } from '@opensumi/ide-core-common';

import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import { IExtHostTheme, IMainThreadTheme } from '../../../common/sumi/theme';

export function createThemeApi(theme: ExtHostTheme) {
  return {
    getThemeColors: async () => theme.getThemeColors(),
    onThemeChanged: theme.onThemeChanged,
  };
}

export class ExtHostTheme implements IExtHostTheme {
  private proxy: IMainThreadTheme;

  private _onThemeChanged = new Emitter<void>();

  public readonly onThemeChanged = this._onThemeChanged.event;

  constructor(private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadTheme);
  }

  async $notifyThemeChanged(): Promise<void> {
    this._onThemeChanged.fire();
  }

  async getThemeColors(): Promise<{ [key: string]: string }> {
    return this.proxy.$getThemeColors();
  }
}
