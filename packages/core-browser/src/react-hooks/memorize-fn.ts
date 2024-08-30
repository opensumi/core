import { useCallback, useMemo, useRef } from 'react';

export function useMemorizeFn<T extends (...args: any[]) => any>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = useMemo(() => fn, [fn]);
  return useCallback((...args: any) => fnRef.current(...args), []) as T;
}
