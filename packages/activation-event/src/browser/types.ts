import { Injectable } from '@ali/common-di';
import { IDisposable } from '@ali/ide-core-browser';

@Injectable()
export abstract class ActivationEventService {

  abstract fireEvent(topic: string, data?: string): Promise<void>;

  abstract onEvent(event: string, listener): IDisposable;

  abstract addWildCardTopic(topic: string): IDisposable;

}
