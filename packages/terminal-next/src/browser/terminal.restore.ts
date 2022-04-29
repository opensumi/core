import { Injectable, Autowired } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ITerminalRestore, ITerminalController, ITerminalInternalService } from '../common';

@Injectable()
export class TerminalRestore extends Disposable implements ITerminalRestore {
  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  get storageKey() {
    // 集成方根据自己的场景来自定义storageKey做到终端恢复场景的准确性
    return 'OPENSUMI_TERMINAL_RESTORE';
  }

  save() {
    const json = this.controller.toJSON();
    const key = this.storageKey;
    window.localStorage.setItem(key, JSON.stringify(json));
  }

  restore() {
    const key = this.storageKey;
    const history = window.localStorage.getItem(key);
    window.localStorage.removeItem(key); // 触发恢复之后清除掉缓存
    if (history) {
      try {
        return this.controller.recovery(JSON.parse(history));
      } catch {
        /** nothing */
      }
    }
    return Promise.resolve();
  }
}
