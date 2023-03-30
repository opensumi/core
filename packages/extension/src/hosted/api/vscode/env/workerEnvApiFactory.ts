import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';

import { MainThreadAPIIdentifier, IMainThreadEnv, IExtHostEnv } from '../../../../common/vscode';

export function createWorkerHostEnvAPIFactory(
  rpcProtocol: IRPCProtocol,
  extHostEnv: IExtHostEnv,
): Pick<typeof vscode.env, 'clipboard' | 'openExternal' | 'language'> {
  const mainThreadEnvProxy: IMainThreadEnv = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEnv);
  return {
    // TODO: initWorkerThreadAPIProxy 有时序问题，没有等待 worker host api 准备好就发送 port 了，因此不能先取值
    get language() {
      return extHostEnv.getEnvValues().language;
    },
    clipboard: {
      readText: () => mainThreadEnvProxy.$clipboardReadText(),
      writeText: (text: string) => mainThreadEnvProxy.$clipboardWriteText(text),
    },
    openExternal(uri) {
      return mainThreadEnvProxy.$openExternal(uri);
    },
  };
}
