import { useState, useEffect, DependencyList, useCallback } from 'react';
import { DisposableStore, IDisposable } from '@ali/ide-core-common';
import { equals } from '@ali/ide-core-common/lib/utils/arrays';

import { MenuNode } from '../menu/next/base';
import { IMenu } from '../menu/next/menu-service';
import { splitMenuItems } from '../menu/next/menu-util';

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

function menuNodeEquals(a: MenuNode, b: MenuNode): boolean {
  return a.id === b.id;
}

export function useMenus(menuInitalizer: IMenu | (() => IMenu), splitMarker?: 'navigation' | 'inline') {
  const [menuConfig, setMenuConfig] = useState<[MenuNode[], MenuNode[]]>([[], []]);

  const initalizer = useCallback(() => {
    return typeof menuInitalizer === 'function'
      ? menuInitalizer()
      : menuInitalizer;
  }, []);

  useDisposable(() => {
    // initialize
    const menus = initalizer();
    updateMenuConfig(menus);

    function updateMenuConfig(menus: IMenu) {
      const menuNodes = menus.getMenuNodes();
      const result = splitMenuItems(menuNodes, splitMarker);

      // menu nodes 对比
      if (
        equals(result[0], menus[0], menuNodeEquals)
        && equals(result[1], menus[1], menuNodeEquals)
      ) {
        return;
      }

      setMenuConfig(result);
    }

    return [
      menus,
      menus.onDidChange(() => {
        updateMenuConfig(menus);
      }),
    ];
  }, [ initalizer ]);

  return menuConfig;
}
