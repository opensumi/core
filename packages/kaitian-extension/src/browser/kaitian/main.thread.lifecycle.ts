import { Injectable, Injector } from '@ali/common-di';
import { IElectronMainLifeCycleService } from '@ali/ide-core-common/lib/electron';
import { IRPCProtocol } from '@ali/ide-connection';
import { isElectronRenderer, ExtensionCandiDate } from '@ali/ide-core-common';
import { electronEnv } from '@ali/ide-core-browser';

import { IMainThreadLifeCycle } from '../../common/kaitian/lifecycle';

@Injectable({ multiple: true })
export class MainThreaLifeCycle implements IMainThreadLifeCycle {

  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
  }

  $setExtensionCandidate(candidate: ExtensionCandiDate[]) {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.setExtensionCandidate(candidate, electronEnv.currentWindowId);
    } else {
      throw new Error('Not implemented');
    }
  }

  $setExtensionDir(dir: string) {
    if (isElectronRenderer()) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.setExtensionDir(dir, electronEnv.currentWindowId);
    } else {
      throw new Error('Not implemented');
    }
  }
}
