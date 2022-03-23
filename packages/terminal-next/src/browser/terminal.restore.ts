import { Injectable, Autowired } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { Disposable } from '@opensumi/ide-core-common';

import { ITerminalRestore, ITerminalController, ITerminalInternalService, ITerminalBrowserHistory } from '../common';

@Injectable()
export class TerminalRestore extends Disposable implements ITerminalRestore {
  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(WSChannelHandler)
  protected readonly wsChannelHandler: WSChannelHandler;

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
    // TODO: 考虑迁移到controller中
    const currentClientId = this.wsChannelHandler.clientId;
    // HACK: 因为现在的终端重连是有问题的，是ClientID机制导致的，因此在拿出记录恢复终端的时候，需要把里面的ClientID替换为当前活跃窗口的ClientID
    // 同时在独立PtyService中，把终端重连的标识转变为真正的realSessionId  也就是 ${clientId}|${realSessionId}
    if (history) {
      try {
        const historyObj = JSON.parse(history) as ITerminalBrowserHistory;
        const currentRealSessionId = historyObj.current?.split('|')?.[1];
        if (historyObj.current) {
          historyObj.current = `${currentClientId}|${currentRealSessionId}`;
        }
        historyObj.groups = historyObj.groups.map((group) => {
          if (Array.isArray(group)) {
            // 替换clientId为当前窗口ClientID
            return group.map((item) => `${currentClientId}|${(item as string)?.split('|')?.[1]}`);
          } else {
            return group;
          }
        });
        // eslint-disable-next-line no-console
        console.log('restore: history', JSON.parse(history), 'historyObj', historyObj);
        return this.controller.recovery(historyObj);
      } catch {
        /** nothing */
      }
    }
    return Promise.resolve();
  }
}
