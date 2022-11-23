import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { ScopedBrowserStorageService, AppConfig, Disposable } from '@opensumi/ide-core-browser';

import { ITerminalRestore, ITerminalController, ITerminalInternalService, ITerminalBrowserHistory } from '../common';

const DEFAULT_TERMINAL_STORE_KEY = 'OPENSUMI_TERMINAL_RESTORE';
@Injectable()
export class TerminalRestore extends Disposable implements ITerminalRestore {
  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  protected readonly inject: Injector;

  protected readonly scopedBrowserStorageService: ScopedBrowserStorageService;

  constructor() {
    super();
    this.scopedBrowserStorageService = this.inject.get(ScopedBrowserStorageService, [this.appConfig.workspaceDir]);
  }

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
    // this.scopedBrowserStorageService.removeData(key); // 触发恢复之后清除掉缓存
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
