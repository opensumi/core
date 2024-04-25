import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, ScopedBrowserStorageService } from '@opensumi/ide-core-browser';

import { ITerminalBrowserHistory, ITerminalController, ITerminalInternalService, ITerminalRestore } from '../common';

const DEFAULT_TERMINAL_STORE_KEY = 'OPENSUMI_TERMINAL_RESTORE';
@Injectable()
export class TerminalRestore extends Disposable implements ITerminalRestore {
  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(ScopedBrowserStorageService)
  protected readonly scopedBrowserStorageService: ScopedBrowserStorageService;

  get storageKey() {
    // 集成方可以根据自己的场景来通过 override 自定义 storageKey 做到终端恢复场景的准确性
    return DEFAULT_TERMINAL_STORE_KEY;
  }

  save() {
    const json = this.controller.toJSON();
    const key = this.storageKey;
    this.scopedBrowserStorageService.setData(key, json);
  }

  restore() {
    const key = this.storageKey;
    const history = this.scopedBrowserStorageService.getData<ITerminalBrowserHistory>(key);

    if (history) {
      try {
        return this.controller.recovery(history);
      } catch (_e) {
        /** nothing */
      }
    }
    return Promise.resolve();
  }
}
