import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpc/multiplexer';
import { Schemes } from '@opensumi/ide-core-common';

import { IExtHostEnv, IMainThreadEnv, MainThreadAPIIdentifier } from '../../../../common/vscode';

import type vscode from 'vscode';

export function createWorkerHostEnvAPIFactory(
  rpcProtocol: IRPCProtocol,
  extHostEnv: IExtHostEnv,
): Pick<typeof vscode.env, 'appName' | 'appRoot' | 'clipboard' | 'openExternal' | 'language' | 'uriScheme'> {
  const mainThreadEnvProxy: IMainThreadEnv = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEnv);
  return {
    get appName() {
      return extHostEnv.getEnvValues().appName;
    },
    get appRoot() {
      return extHostEnv.getEnvValues().appRoot;
    },
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
    uriScheme: Schemes.file,
  };
}
