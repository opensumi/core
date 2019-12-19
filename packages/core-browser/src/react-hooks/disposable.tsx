import { useEffect, DependencyList } from 'react';
import { DisposableStore, IDisposable } from '@ali/ide-core-common';

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
