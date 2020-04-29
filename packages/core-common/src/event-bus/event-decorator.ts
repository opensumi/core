import { DebounceSettings, ThrottleSettings } from 'lodash';

import debounce = require('lodash.debounce');
import throttle = require('lodash.throttle');

import { BasicEvent } from './basic-event';
import { ConstructorOf } from '../declare';
import { IEventBus } from './event-bus-types';

const EVENT_TOKEN = Symbol('EVENT_TOKEN');

import { Autowired } from '@ali/common-di'
import { Disposable } from '../disposable';

export class WithEventBus extends Disposable {
  @Autowired(IEventBus)
  protected eventBus: IEventBus;

  constructor(...args: any[]) {
    super(...args);

    const map: Map<string, ConstructorOf<any>> = Reflect.getMetadata(EVENT_TOKEN, this) || new Map();
    for (const [key, Construcotor] of map.entries()) {
      const dispose = this.eventBus.on(Construcotor, (event: any) => {
        return (this as any)[key](event);
      });
      this.addDispose(dispose);
    }
  }
}

export function OnEvent<T extends BasicEvent<any>>(Construcotor: ConstructorOf<T>) {
  return (target: object, key: string, descriptor: TypedPropertyDescriptor<(event: T) => void>) => {
    const map: Map<string, ConstructorOf<any>> = Reflect.getMetadata(EVENT_TOKEN, target) || new Map();
    map.set(key, Construcotor);
    Reflect.defineMetadata(EVENT_TOKEN, map, target);
  }
}

export function Debounce(duration: number = 500, options?: DebounceSettings) {
  return (target: object, key: string, descriptor: PropertyDescriptor) => {
    return {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: function getter () {
        // mount debounced fn to instance not the original class
        Object.defineProperty(this, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          value: debounce(descriptor.value, duration, options),
        })

        return this[key];
      },
    };
  };
}

export function Throttle(duration: number = 500, options?: ThrottleSettings) {
  return (target: object, key: string, descriptor: PropertyDescriptor) => {
    return {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: function getter () {
        // mount debounced fn to instance not the original class
        Object.defineProperty(this, key, {
          configurable: true,
          enumerable: descriptor.enumerable,
          value: throttle(descriptor.value, duration, options),
        })

        return this[key];
      },
    };
  };
}
