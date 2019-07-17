import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, MainThreadAPIIdentifier } from '../../common';
import { ExtHostStatusBar } from './ext.statusbar.host';
import { Disposable } from 'vscode-ws-jsonrpc';

export function createWindowApiFactory(rpcProtocol: IRPCProtocol) {

  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));

  return {
    setStatusBarMessage(text: string): Disposable {

      // step2
      return extHostStatusBar.setStatusBarMessage(text);

    },
  };
}
