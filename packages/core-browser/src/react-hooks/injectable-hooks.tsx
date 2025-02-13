import { useContext, useEffect, useMemo, useState } from 'react';

import { Injector, Token } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ConfigContext } from '../react-providers/config-provider';

import { useMemorizeFn } from './memorize-fn';

import type { EventEmitter } from '@opensumi/events';

function isDisposable(target: any): target is Disposable {
  return target && (target as any).dispose && !target.disposed;
}

export function useInjectable<T = any>(Constructor: Token, args?: any): T {
  const { injector } = useContext(ConfigContext);

  const instance = useMemo(() => injector?.get(Constructor, args), [injector, Constructor]);

  useEffect(
    () => () => {
      // 如果这是多例模式，DI 中不会留有这个实例对象
      // 由于实例可能存在在父 injector 中，需要做一下递归判断
      let curr: Injector | undefined = injector;
      while (curr && !curr.hasInstance(instance)) {
        curr = (curr as any).parent;
      }
      if (!curr) {
        if (isDisposable(instance)) {
          instance.dispose();
        }
      }
    },
    [instance],
  );

  return instance;
}

type GenericExtract<T> = T extends EventEmitter<infer P> ? P : T;

export function useEventDrivenState<T, Events extends EventEmitter<any>, Event extends keyof GenericExtract<Events>>(
  emitter: Events,
  eventName: Event,
  factory: (emitter: any) => T,
) {
  const memorizeFactory = useMemorizeFn(factory);
  const [state, setState] = useState(memorizeFactory(emitter));

  useEffect(() => {
    const listener = (...args: any[]) => {
      setState(() => memorizeFactory(emitter));
    };
    // 绑定事件前先取下值，避免期间事件已 emit
    listener();
    emitter.on(eventName, listener);
    return () => emitter.off(eventName, listener);
  }, [emitter]);

  return state;
}
