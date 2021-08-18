import { Injectable, Injector, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostKaitianAPIIdentifier } from '../../common/kaitian';
import { IEventBus, WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { IExtHostCommon, IMainThreadCommon } from '../../common/kaitian/common';
import { ExtHostEvent } from '../types';

/**
 * 通用kaitian Main Api
 * 对于一些比较小的零碎功能, 不单独开main.thread.xxx.ts了，这样方便快速开发
 */
@Injectable({ multiple: true })
export class MainThreadCommon extends WithEventBus implements IMainThreadCommon {

  _proxy: IExtHostCommon;

  @Autowired(IEventBus)
  themeService: IEventBus;

  private subscribedEvent = new Set<string>();

  // tslint:disable-next-line: no-unused-variable
  constructor(private rpcProtocol: IRPCProtocol, private injector: Injector) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostKaitianAPIIdentifier.ExtHostCommon);
  }

  @OnEvent(ExtHostEvent)
  onExtHostEvent(e: ExtHostEvent) {
    if (this.subscribedEvent.has(e.payload.eventName)) {
      return this._proxy.$acceptEvent(e.payload.eventName, e.payload.eventArgs);
    }
  }

  async $subscribeEvent(eventName: string) {
    this.subscribedEvent.add(eventName);
  }

  async $unSubscribeEvent(eventName: string) {
    this.subscribedEvent.delete(eventName);
  }
}
