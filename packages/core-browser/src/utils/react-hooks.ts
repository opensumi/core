import { useState, useEffect, DependencyList, useCallback } from 'react';
import { DisposableStore, IDisposable } from '@ali/ide-core-common';

import { MenuNode } from '../menu/next/base';
import { IMenu, IMenuSeparator, IContextMenu } from '../menu/next/menu.interface';
import { generateInlineActions } from '../menu/next/menu-util';

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

export function useDisposable(callback: () => IDisposable[] | void, deps: DependencyList = []) {
  useEffect(() => {
    const disposableStore = new DisposableStore();
    const disposables = callback();
    if (Array.isArray(disposables)) {
      disposables.forEach((disposable) => {
        disposableStore.add(disposable);
      });
    }

    return () => {
      disposableStore.dispose();
    };
  }, deps);
}

export function useMenus(
  menuInitializer: IMenu | (() => IMenu),
  separator?: IMenuSeparator,
  args?: any[],
) {
  const [menuConfig, setMenuConfig] = useState<[MenuNode[], MenuNode[]]>([[], []]);

  const initializer = useCallback(() => {
    return typeof menuInitializer === 'function'
      ? menuInitializer()
      : menuInitializer;
  }, []);

  useDisposable(() => {
    // initialize
    const menus = initializer();
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
      menus,
      menus.onDidChange(() => {
        updateMenuConfig(menus, args);
      }),
    ];
  }, [ initializer, args ]);

  return menuConfig;
}

export function useContextMenus(
  menuInitializer: IContextMenu | (() => IContextMenu),
) {
  const [menuConfig, setMenuConfig] = useState<[MenuNode[], MenuNode[]]>([[], []]);

  const initializer = useCallback(() => {
    return typeof menuInitializer === 'function'
      ? menuInitializer()
      : menuInitializer;
  }, []);

  useDisposable(() => {
    // initialize
    const menus = initializer();
    updateMenuConfig(menus);

    function updateMenuConfig(menuArg: IContextMenu) {
      const result = menuArg.getGroupedMenuNodes();
      setMenuConfig(result);
    }

    return [
      menus,
      menus.onDidChange(() => {
        updateMenuConfig(menus);
      }),
    ];
  }, [ initializer ]);

  return menuConfig;
}
