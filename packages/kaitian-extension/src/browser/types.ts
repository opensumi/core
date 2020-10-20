import { Injectable } from '@ali/common-di';
import { BasicEvent, IDisposable } from '@ali/ide-core-browser';

export type Serializable = any;

export interface IExtHostEventPayload {
  eventName: string;
  eventArgs: Serializable[];
}

export class ExtHostEvent extends BasicEvent<IExtHostEventPayload> {}

@Injectable()
export abstract class IActivationEventService {

  abstract fireEvent(topic: string, data?: string): Promise<void>;

  abstract onEvent(event: string, listener): IDisposable;

  abstract addWildCardTopic(topic: string): IDisposable;

  activatedEventSet: Set<{topic: string, data: string}>;

}

export class ExtensionApiReadyEvent extends BasicEvent<void> {}

/**
 * 扩展被激活前的事件
 */
export class ExtensionBeforeActivateEvent extends BasicEvent<void> {}
