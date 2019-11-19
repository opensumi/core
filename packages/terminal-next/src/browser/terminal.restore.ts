import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-common';
import { ITerminalRestore, ITerminalController, ITerminalExternalService } from '../common';

@Injectable()
export class TerminalRestore extends Disposable implements ITerminalRestore {
  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalExternalService)
  service: ITerminalExternalService;

  save() {
    const json = this.controller.toJSON();
    const key = this.service.restore();
    window.localStorage.setItem(key, JSON.stringify(json));
  }

  restore() {
    const key = this.service.restore();
    const history = window.localStorage.getItem(key);
    if (history) {
      try {
        return this.controller.recovery(JSON.parse(history));
      } catch { /** do nothing */ }
    }
    return Promise.resolve();
  }
}
