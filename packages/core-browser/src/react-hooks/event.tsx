import React from 'react';

import { Event, Disposable, ConstructorOf, BasicEvent, IEventBus } from '@opensumi/ide-core-common';

import { useInjectable } from './injectable-hooks';

/**
 * 在事件来临时更新当前元素
 * 会自动 dispose 监听器
 * @param event 要监听的事件
 * @param dependencies React.useEffect的依赖
 * @param condition 返回 true 时
 */
export function useUpdateOnEvent<T = any>(
  event: Event<T>,
  dependencies: any[] = [],
  condition?: (payload: T) => boolean,
) {
  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(
      event((payload: T) => {
        if (disposer.disposed) {
          return;
        }
        if (!condition) {
          forceUpdate();
        } else {
          if (condition(payload)) {
            forceUpdate();
          }
        }
      }),
    );
    return () => {
      disposer.dispose();
    };
  }, dependencies);
}

export function useUpdateOnEventBusEvent<T = any>(
  eventType: ConstructorOf<BasicEvent<T>>,
  dependencies: any[] = [],
  condition?: (payload: T) => boolean,
) {
  const [, updateState] = React.useState<any>();
  const forceUpdate = React.useCallback(() => updateState({}), []);
  const eventBus: IEventBus = useInjectable(IEventBus);

  React.useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(
      eventBus.on(eventType, (event: BasicEvent<T>) => {
        if (disposer.disposed) {
          return;
        }
        if (!condition) {
          forceUpdate();
        } else {
          if (condition(event.payload)) {
            forceUpdate();
          }
        }
      }),
    );
    return () => {
      disposer.dispose();
    };
  }, dependencies);
}
