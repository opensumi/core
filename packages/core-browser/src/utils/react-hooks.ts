import { useState, useEffect, DependencyList, useRef } from 'react';
import { DisposableStore, IDisposable } from '@ali/ide-core-common';

import { MenuNode } from '../menu/next/base';
import { IMenu, IMenuSeparator, IContextMenu } from '../menu/next/menu.interface';
import { generateInlineActions } from '../menu/next/menu-util';
import React = require('react');

export function useDebounce(value, delay) {
  const [denouncedValue, setDenouncedValue] = useState(value);

  useEffect(
    () => {
      const handler = setTimeout(() => {
        setDenouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay],
  );

  return denouncedValue;
}

export function useDisposable(callback: () => IDisposable | IDisposable[], deps: DependencyList = []) {
  useEffect(() => {
    const disposableStore = new DisposableStore();
    const disposables = callback();
    if (Array.isArray(disposables)) {
      disposables.forEach((disposable) => {
        disposableStore.add(disposable);
      });
    } else {
      disposableStore.add(disposables);
    }

    return () => {
      disposableStore.dispose();
    };
  }, deps);
}

export function useMenus(
  menus: IMenu,
  separator?: IMenuSeparator,
  args?: any[],
) {
  const [menuConfig, setMenuConfig] = useState<[MenuNode[], MenuNode[]]>([[], []]);

  useDisposable(() => {
    // initialize
    updateMenuConfig(menus, args);

    function updateMenuConfig(menuArg: IMenu, argList?: any[]) {
      const result = generateInlineActions({
        menus: menuArg,
        separator,
        args: argList,
      });

      setMenuConfig(result);
    }

    return [
      menus.onDidChange(() => {
        updateMenuConfig(menus, args);
      }),
    ];
  }, [ menus, args ]);

  return menuConfig;
}

export function useContextMenus(
  menus: IContextMenu,
) {
  const [menuConfig, setMenuConfig] = useState<[MenuNode[], MenuNode[]]>([[], []]);
  useDisposable(() => {
    updateMenuConfig(menus);

    function updateMenuConfig(menuArg: IContextMenu) {
      const result = menuArg.getGroupedMenuNodes();
      setMenuConfig(result);
    }

    return [
      menus.onDidChange(() => {
        updateMenuConfig(menus);
      }),
    ];
  }, [ menus ]);

  return menuConfig;
}

const cancellablePromise = (promise) => {
  let isCanceled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(
      (value) => (isCanceled ? reject({ isCanceled, value }) : resolve(value)),
      (error) => reject({ isCanceled, error }),
    );
  });

  return {
    promise: wrappedPromise,
    cancel: () => (isCanceled = true),
  };
};

const delay = (n) => new Promise((resolve) => setTimeout(resolve, n));

const useCancellablePromises = () => {
  const pendingPromises = useRef<any[]>([]);

  const appendPendingPromise = (promise) =>
    pendingPromises.current = [...pendingPromises.current, promise];

  const removePendingPromise = (promise) =>
    pendingPromises.current = pendingPromises.current.filter((p) => p !== promise);

  const clearPendingPromises = () => pendingPromises.current.map((p) => p.cancel());

  const api = {
    appendPendingPromise,
    removePendingPromise,
    clearPendingPromises,
  };

  return api;
};

export function useClickPreventionOnDoubleClick(onClick, onDoubleClick) {
  const api = useCancellablePromises();

  const handleClick = (event: React.MouseEvent) => {
    event.persist();
    event.stopPropagation();
    api.clearPendingPromises();
    const waitForClick = cancellablePromise(delay(200));
    api.appendPendingPromise(waitForClick);
    return waitForClick.promise
      .then(() => {
        api.removePendingPromise(waitForClick);
        onClick(event);
      })
      .catch((errorInfo) => {
        api.removePendingPromise(waitForClick);
        if (!errorInfo.isCanceled) {
          throw errorInfo.error;
        }
      });
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.persist();
    event.stopPropagation();
    api.clearPendingPromises();
    onDoubleClick(event.nativeEvent);
  };

  return [handleClick, handleDoubleClick];
}
