import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IExtHostWindowState } from '../../../common/vscode';
import { Optinal } from '@ali/common-di';

export class MainThreadWindowState {

  private readonly proxy: IExtHostWindowState;
  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWindowState);

    window.addEventListener('blur', () => {
      this.proxy.$setWindowState(false);
    });

    window.addEventListener('focus', () => {
      this.proxy.$setWindowState(true);
    });
  }

}
