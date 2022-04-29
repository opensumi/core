import { Autowired } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-utils';

import { ConstructorOf } from '../declare';

import { BasicEvent } from './basic-event';
import { IEventBus } from './event-bus-types';

const EVENT_TOKEN = Symbol('EVENT_TOKEN');

export class WithEventBus extends Disposable {
  @Autowired(IEventBus)
  protected eventBus: IEventBus;

  constructor(...args: any[]) {
    super(...args);

    const map: Map<string, ConstructorOf<any>> = Reflect.getMetadata(EVENT_TOKEN, this) || new Map();
    for (const [key, Constructor] of map.entries()) {
      const dispose = this.eventBus.on(Constructor, (event: any) => (this as any)[key](event));
      this.addDispose(dispose);
    }
  }
}

export function OnEvent<T extends BasicEvent<any>>(Constructor: ConstructorOf<T>) {
  return (target: object, key: string, descriptor: TypedPropertyDescriptor<(event: T) => void>) => {
    const map: Map<string, ConstructorOf<any>> = Reflect.getMetadata(EVENT_TOKEN, target) || new Map();
    map.set(key, Constructor);
    Reflect.defineMetadata(EVENT_TOKEN, map, target);
  };
}
