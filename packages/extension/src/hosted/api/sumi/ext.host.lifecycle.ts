import { IRPCProtocol } from '@opensumi/ide-connection';
import { ExtensionCandidate } from '@opensumi/ide-core-common';

import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import { IExtHostLifeCycle, IMainThreadLifeCycle } from '../../../common/sumi/lifecycle';
import { IExtHostCommands } from '../../../common/vscode';

export function createLifeCycleApi(extHostCommands: IExtHostCommands, lifeCycle: IExtHostLifeCycle) {
  return {
    setExtensionDir: (dir: string) => {
      lifeCycle.setExtensionDir(dir);
    },
    setExtensionCandidate: (exts: ExtensionCandidate[]) => {
      lifeCycle.setExtensionCandidate(exts);
    },
  };
}

export class ExtHostLifeCycle implements IExtHostLifeCycle {
  private proxy: IMainThreadLifeCycle;

  constructor(private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadLifecycle);
  }

  public setExtensionDir(path: string) {
    this.proxy.$setExtensionDir(path);
  }

  public setExtensionCandidate(candidate: ExtensionCandidate[]) {
    this.proxy.$setExtensionCandidate(candidate);
  }
}
