import { Injectable, Injector, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { IEventBus, WithEventBus, OnEvent } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';

import { ExtHostSumiAPIIdentifier } from '../../common/sumi';
import { IExtHostCommon, IMainThreadCommon } from '../../common/sumi/common';
import { ExtHostEvent } from '../types';

/**
 * 通用 Sumi Main Api
 * 对于一些比较小的零碎功能, 不单独开main.thread.xxx.ts了，这样方便快速开发
 */
@Injectable({ multiple: true })
export class MainThreadCommon extends WithEventBus implements IMainThreadCommon {
  _proxy: IExtHostCommon;

  @Autowired(IEventBus)
  themeService: IEventBus;

  private subscribedEvent = new Set<string>();

  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostSumiAPIIdentifier.ExtHostCommon);
  }

  @OnEvent(ExtHostEvent)
  onExtHostEvent(e: ExtHostEvent) {
    if (this.subscribedEvent.has(e.payload.eventName)) {
      return this._proxy.$acceptEvent(e.payload.eventName, e.payload.eventArgs);
    }
  }

  async $subscribeEvent(eventName: string) {
    this.subscribedEvent.add(eventName);

    this.addDispose(
      Disposable.create(() => {
        this.$unSubscribeEvent(eventName);
      }),
    );
  }

  async $unSubscribeEvent(eventName: string) {
    this.subscribedEvent.delete(eventName);
  }
}
