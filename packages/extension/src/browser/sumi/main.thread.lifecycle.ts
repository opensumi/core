import { Injectable, Injector } from '@ide-framework/common-di';
import { IElectronMainLifeCycleService } from '@ide-framework/ide-core-common/lib/electron';
import { IRPCProtocol } from '@ide-framework/ide-connection';
import { isElectronRenderer, ExtensionCandidate } from '@ide-framework/ide-core-common';
import { electronEnv } from '@ide-framework/ide-core-browser';

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
