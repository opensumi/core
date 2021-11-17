import { IMainThreadTheming, IExtHostTheming } from '../../../common/vscode';
import { IRPCProtocol } from '@ide-framework/ide-connection';
import { Autowired, Injectable, Optinal } from '@ide-framework/common-di';
import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { IThemeService } from '@ide-framework/ide-theme';
import { IDisposable } from '@ide-framework/ide-core-common';

@Injectable({ multiple: true })
export class MainThreadTheming implements IMainThreadTheming {
  private proxy: IExtHostTheming;

  @Autowired(IThemeService)
  private readonly _themeService: IThemeService;

  private readonly _themeChangeListener: IDisposable;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTheming);
    this._themeChangeListener = this._themeService.onThemeChange((e) => {
      this.proxy.$onColorThemeChange(e.type);
    });
    this.proxy.$onColorThemeChange(this._themeService.getCurrentThemeSync().type);
  }

  dispose(): void {
    this._themeChangeListener.dispose();
  }

}
