import { Autowired, Injectable, Injector } from '@opensumi/di';
import { AppConfig, electronEnv } from '@opensumi/ide-core-browser';
import { ExtensionCandidate } from '@opensumi/ide-core-common';
import { IElectronMainLifeCycleService } from '@opensumi/ide-core-common/lib/electron';
import { throwNonElectronError } from '@opensumi/ide-core-common/lib/error';

import { IMainThreadLifeCycle } from '../../common/sumi/lifecycle';

@Injectable({ multiple: true })
export class MainThreadLifeCycle implements IMainThreadLifeCycle {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  constructor(private injector: Injector) {}

  $setExtensionCandidate(candidate: ExtensionCandidate[]) {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.setExtensionCandidate(candidate, electronEnv.currentWindowId);
    } else {
      throwNonElectronError('MainThreadLifeCycle.$setExtensionCandidate');
    }
  }

  $setExtensionDir(dir: string) {
    if (this.appConfig.isElectronRenderer) {
      const electronMainLifecycle: IElectronMainLifeCycleService = this.injector.get(IElectronMainLifeCycleService);
      electronMainLifecycle.setExtensionDir(dir, electronEnv.currentWindowId);
    } else {
      throwNonElectronError('MainThreadLifeCycle.$setExtensionDir');
    }
  }
}
