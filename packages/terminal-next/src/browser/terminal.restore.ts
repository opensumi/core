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
    return 'KAITIAN';
  }

  save() {
    const json = this.controller.toJSON();
    const key = this.storageKey;
    window.localStorage.setItem(key, JSON.stringify(json));
  }

  restore() {
    const key = this.storageKey;
    const history = window.localStorage.getItem(key);
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
