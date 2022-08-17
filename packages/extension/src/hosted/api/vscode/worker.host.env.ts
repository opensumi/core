import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Emitter, LogLevel as KTLogLevel } from '@opensumi/ide-core-common';

import { MainThreadAPIIdentifier, IMainThreadEnv } from '../../../common/vscode';
import { IExtHostEnv, ExtHostEnvValues } from '../../../common/vscode';
import { LogLevel } from '../../../common/vscode/ext-types';

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

export class WorkerHostEnv implements IExtHostEnv {
  constructor(rpcProtocol: IRPCProtocol) {}

  $setEnvValues(values: Partial<ExtHostEnvValues>) {
    throw new Error('Method not implemented.');
  }

  $fireChangeLogLevel(value: KTLogLevel) {
    throw new Error('Method not implemented.');
  }

  $setLogLevel(value: KTLogLevel) {
    throw new Error('Method not implemented.');
  }
  logLevel: LogLevel;
  setEnvValues(values: ExtHostEnvValues) {
    throw new Error('Method not implemented.');
  }
  getEnvValues(): ExtHostEnvValues {
    throw new Error('Method not implemented.');
  }
  asExternalUri(target: vscode.Uri): Promise<vscode.Uri> {
    throw new Error('Method not implemented.');
  }
  logLevelChangeEmitter: Emitter<LogLevel>;
}
