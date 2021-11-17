import { IRPCProtocol } from '@ide-framework/ide-connection';
import { Emitter } from '@ide-framework/ide-core-common';

import { MainThreadKaitianAPIIdentifier } from '../../../common/kaitian';
import { IExtHostTheme, IMainThreadTheme } from '../../../common/kaitian/theme';

export function createThemeApi(
  theme: ExtHostTheme,
) {
  return {
    getThemeColors: async (dir: string) => {
      return theme.getThemeColors();
    },
    onThemeChanged: theme.onThemeChanged,
  };
}

export class ExtHostTheme implements IExtHostTheme {

  private proxy: IMainThreadTheme;

  private _onThemeChanged = new Emitter<void>();

  public readonly onThemeChanged = this._onThemeChanged.event;

  constructor(
    private rpcProtocol: IRPCProtocol,
  ) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadKaitianAPIIdentifier.MainThreadTheme);
  }

  async $notifyThemeChanged(): Promise<void> {
    this._onThemeChanged.fire();
  }

  async getThemeColors(): Promise<{[key: string]: string}> {
    return this.proxy.$getThemeColors();
  }
}
