import { IRPCProtocol } from '@opensumi/ide-connection';
import { ExtHostAPIIdentifier, IExtHostWindowState } from '../../../common/vscode';
import { Optinal, Injectable } from '@opensumi/common-di';

@Injectable({multiple: true})
export class MainThreadWindowState {

  private readonly proxy: IExtHostWindowState;
  private blurHandler;
  private focusHandler;
  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWindowState);

    this.blurHandler = () => {
      this.proxy.$setWindowState(false);
    };
    this.focusHandler = () => {
      this.proxy.$setWindowState(true);
    };
    window.addEventListener('blur', this.blurHandler);

    window.addEventListener('focus', this.focusHandler);
  }

  public dispose() {
    window.removeEventListener('blur', this.blurHandler);
    window.removeEventListener('focus', this.focusHandler);
  }

}
