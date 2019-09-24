import { useState, useEffect, DependencyList } from 'react';
import { DisposableStore, IDisposable } from '@ali/ide-core-common';

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

export function useDisposable(callback: () => IDisposable[], deps: DependencyList = []) {
  useEffect(() => {
    const disposableStore = new DisposableStore();
    const disposables = callback();
    disposables.forEach((disposable) => {
      disposableStore.add(disposable);
    });

    return () => {
      disposableStore.dispose();
    };
  }, deps);
}
