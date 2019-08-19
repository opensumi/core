import ResizeObserver from 'resize-observer-polyfill';
import { RefObject, useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';

export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(
    () => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay],
  );

  return debouncedValue;
}

export interface ComponentSize {
  width: number;
  height: number;
}

export function useComponentSize<T extends HTMLElement>(ref: RefObject<T> | null) {
  const [componentSize, setComponentSize] = useState<ComponentSize>({
    width: 0,
    height: 0,
  });

  const handleResize = useCallback(
    function handleResize() {
      if (ref && ref.current) {
        setComponentSize(        {
          width: ref.current.offsetWidth,
          height: ref.current.offsetHeight,
        });
      }
    },
    [ref],
  );

  useLayoutEffect(() => {
    if (!ref || !ref.current) {
      return;
    }

    handleResize();

    if (typeof ResizeObserver === 'function') {
      let resizeObserver;
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(ref.current);

      return () => {
        resizeObserver.disconnect();
        resizeObserver = null;
      };
    } else {
      window.addEventListener('resize', handleResize);
      return () => { window.removeEventListener('resize', handleResize); };
    }
  }, [ref && ref.current]);

  return componentSize;
}
