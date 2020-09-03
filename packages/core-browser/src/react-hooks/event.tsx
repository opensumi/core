import * as React from 'react';
import { Event, Disposable } from '@ali/ide-core-common';

/**
 * 在事件来临时更新当前元素
 * 会自动 dispose 监听器
 * @param event 要监听的事件
 * @param dependencies React.useEffect的依赖
 * @param condition 返回 true 时
 */
export function useUpdateOnEvent<T = any>(event: Event<T>, dependencies: any[] = [], condition?: (payload: T) => boolean) {
  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(event((payload: T) => {
      if (!condition) {
        forceUpdate();
      } else {
        if (condition(payload)) {
          forceUpdate();
        }
      }
    }));
    return () => {
      disposer.dispose();
    };
  }, dependencies );
}
