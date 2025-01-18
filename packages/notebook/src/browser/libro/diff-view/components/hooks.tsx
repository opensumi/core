import { useLayoutEffect } from 'react';
import { useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';

export interface Size {
  width?: number;
  height?: number;
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;

  return ref;
}

export default useLatest;
export function useSize(fn: () => void, ref: React.ForwardedRef<HTMLDivElement>): void {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const callback = useLatest((size: Size) => {
    fn();
  });
  useLayoutEffect(() => {
    if (typeof ref !== 'object') {
      return () => {};
    }
    const el = ref?.current;
    if (!el || !fn) {
      return () => {};
    }
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        callback.current({
          width: entry.target.clientWidth,
          height: entry.target.clientHeight,
        });
      });
    });

    resizeObserver.observe(el as HTMLElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [callback, ref, fn]);
}
