import { useState, useEffect, DependencyList } from 'react';
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
