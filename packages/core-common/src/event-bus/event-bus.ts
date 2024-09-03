import { Injectable } from '@opensumi/di';
import { Emitter, Event, IAsyncResult, IDisposable } from '@opensumi/ide-utils';

import { ConstructorOf } from '../declare';

import { BasicEvent } from './basic-event';
import { IAsyncEventFireOpts, IEventBus, IEventFireOpts, IEventListener } from './event-bus-types';

@Injectable()
export class EventBusImpl implements IEventBus {
  private emitterMap = new Map<any, Emitter<any>>();

  fire<T extends BasicEvent<any>>(e: T, opts: IEventFireOpts = {}) {
    const Constructor = e && e.constructor;
    if (typeof Constructor === 'function' && BasicEvent.isPrototypeOf(Constructor)) {
      const emitter = this.emitterMap.get(Constructor);
      if (emitter) {
        emitter.fire(e);
      }
    }
  }

  async fireAndAwait<T extends BasicEvent<any>, R>(
    e: T,
    opts: IAsyncEventFireOpts = { timeout: 2000 },
  ): Promise<IAsyncResult<R>[]> {
    const Constructor = e && e.constructor;
    if (typeof Constructor === 'function' && BasicEvent.isPrototypeOf(Constructor)) {
      const emitter = this.emitterMap.get(Constructor);
      if (emitter) {
        return emitter.fireAndAwait<R>(e, opts.timeout);
      }
    }
    return [];
  }

  on<T>(Constructor: ConstructorOf<T>, listener: IEventListener<T>) {
    const emitter = this.getOrCreateEmitter(Constructor);
    return emitter.event(listener);
  }

  once<T>(Constructor: ConstructorOf<T>, listener: IEventListener<T>) {
    const emitter = this.getOrCreateEmitter(Constructor);
    return Event.once(emitter.event)(listener);
  }

  private getOrCreateEmitter(key: any) {
    const current = this.emitterMap.get(key);
    if (current) {
      return current;
    }

    const emitter = new Emitter();
    this.emitterMap.set(key, emitter);
    return emitter;
  }

  onDirective<T>(directive: string, listener: IEventListener<T>): IDisposable {
    const emitter = this.getOrCreateEmitter(directive);
    return emitter.event(listener);
  }

  fireDirective(directive: string, payload: any) {
    const emitter = this.emitterMap.get(directive);
    if (emitter) {
      emitter.fire(payload);
    }
  }
}
