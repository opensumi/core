import { Injectable } from '@ali/common-di';
import { IEventBus, IEventLisnter, IEventFireOpts } from './event-bus-types';
import { Emitter } from '../event';
import { BasicEvent } from './basic-event';
import { ConstructorOf } from '../declare';

@Injectable()
export class EventBusImpl implements IEventBus {
  private emitterMap = new Map<any, Emitter<any>>();
  
  fire<T extends BasicEvent<any>>(e: T, opts: IEventFireOpts = {}) {
    const Constructor = e && e.constructor;
    if (
      typeof Constructor === 'function' && 
      BasicEvent.isPrototypeOf(Constructor)
    ) {
      const emitter = this.emitterMap.get(Constructor);
      if (emitter) {
        emitter.fire(e);
      }
    }
  }

  on<T>(Constructor: ConstructorOf<T>, listener: IEventLisnter<T>) {
    const emitter = this.getOrCreateEmitter(Constructor);
    return emitter.event(listener);
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
} 
