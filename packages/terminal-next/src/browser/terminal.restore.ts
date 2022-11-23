import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser/lib/react-providers/config-provider';
import { Disposable } from '@opensumi/ide-core-common';

import { ITerminalRestore, ITerminalController, ITerminalInternalService } from '../common';

const DEFAULT_TERMINAL_STORE_KEY = 'OPENSUMI_TERMINAL_RESTORE';

@Injectable()
export class TerminalRestore extends Disposable implements ITerminalRestore {
  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  get storageKey() {
    // 集成方可以根据自己的场景来通过 override 自定义 storageKey 做到终端恢复场景的准确性
    return `${this.appConfig.workspaceDir}-${DEFAULT_TERMINAL_STORE_KEY}`;
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
      } catch (_e) {
        /** nothing */
      }
    }
    return Promise.resolve();
  }
}
