import _debounce from 'lodash.debounce';
import { useState, useEffect, DependencyList } from 'react';

import { Disposable, DisposableStore, IDisposable } from '@opensumi/ide-core-common';

import { PreferenceService, useInjectable } from '..';
import { MenuNode } from '../menu/next/base';
import { generateInlineActions } from '../menu/next/menu-util';
import { IMenu, IMenuSeparator, IContextMenu } from '../menu/next/menu.interface';

export function useDebounce(value, delay) {
  const [denouncedValue, setDenouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDenouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

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
  // 防止 menu 快速变化
  debounce?: { delay: number; maxWait?: number },
) {
  const [menuConfig, setMenuConfig] = useState<[MenuNode[], MenuNode[]]>([[], []]);

  useDisposable(() => {
    let updateMenuConfig = () => {
      const result = generateInlineActions({
        menus,
        separator,
        args,
      });

      setMenuConfig(result);
    };

    if (debounce) {
      updateMenuConfig = _debounce(updateMenuConfig, debounce.delay, { maxWait: debounce.maxWait });
    }

    // initialize
    updateMenuConfig();

    return [
      menus.onDidChange(() => {
        updateMenuConfig();
      }),
    ];
  }, [menus, args]);

  return menuConfig;
}

export function useContextMenus(menus: IContextMenu) {
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
  }, [menus]);

  return menuConfig;
}

export function usePreference<T>(key: string, defaultValue: T) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const [value, setValue] = useState<T>(preferenceService.get<T>(key, defaultValue) ?? defaultValue);

  useEffect(() => {
    const disposer = new Disposable(
      preferenceService.onSpecificPreferenceChange(key, (change) => {
        setValue(change.newValue);
      }),
    );
    return () => {
      disposer.dispose();
    };
  }, []);
  return value;
}
