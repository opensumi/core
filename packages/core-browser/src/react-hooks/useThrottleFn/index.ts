import throttle from 'lodash/throttle';
import { useEffect, useMemo, useRef } from 'react';

export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

type noop = (...args: any[]) => any;

function useThrottleFn<T extends noop>(fn: T, wait: number, options?: ThrottleOptions) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const throttled = useMemo(
    () => throttle((...args: Parameters<T>): ReturnType<T> => fnRef.current(...args), wait, options),
    [],
  );

  useEffect(
    () => () => {
      throttled.cancel();
    },
    [],
  );

  return {
    run: throttled,
    cancel: throttled.cancel,
    flush: throttled.flush,
  };
}

export default useThrottleFn;
