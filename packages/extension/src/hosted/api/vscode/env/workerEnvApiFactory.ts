import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';

import { MainThreadAPIIdentifier, IMainThreadEnv } from '../../../../common/vscode';

export function createWorkerHostEnvAPIFactory(
  rpcProtocol: IRPCProtocol,
): Pick<typeof vscode.env, 'clipboard' | 'openExternal'> {
  const mainThreadEnvProxy: IMainThreadEnv = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEnv);
  return {
    clipboard: {
      readText: () => mainThreadEnvProxy.$clipboardReadText(),
      writeText: (text: string) => mainThreadEnvProxy.$clipboardWriteText(text),
    },
    openExternal(uri) {
      return mainThreadEnvProxy.$openExternal(uri);
    },
  };
}
