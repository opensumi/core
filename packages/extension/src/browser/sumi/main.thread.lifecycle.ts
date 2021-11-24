import { Injectable, Injector } from '@opensumi/common-di';
import { IElectronMainLifeCycleService } from '@opensumi/ide-core-common/lib/electron';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { isElectronRenderer, ExtensionCandidate } from '@opensumi/ide-core-common';
import { electronEnv } from '@opensumi/ide-core-browser';

import { IMainThreadLifeCycle } from '../../common/sumi/lifecycle';

@Injectable({ multiple: true })
export class MainThreadLifeCycle implements IMainThreadLifeCycle {

  constructor(rpcProtocol: IRPCProtocol, private injector: Injector) {
  }

  $setExtensionCandidate(candidate: ExtensionCandidate[]) {
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
