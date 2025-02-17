import _debounce from 'lodash/debounce';
import { DependencyList, useEffect, useMemo, useRef, useState } from 'react';

import { Disposable, DisposableStore, IDisposable } from '@opensumi/ide-core-common';
import { autorun } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/autorun';
import { IObservable } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';

import { IDesignStyleService } from '../design';
import { MenuNode } from '../menu/next/base';
import { generateInlineActions } from '../menu/next/menu-util';
import { IContextMenu, IMenu, IMenuSeparator } from '../menu/next/menu.interface';
import { PreferenceService } from '../preferences/types';
import { useInjectable } from '../react-hooks/injectable-hooks';

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

export function useDesignStyles(styles: string, key: string) {
  const designStyleService = useInjectable<IDesignStyleService>(IDesignStyleService);

  if (!styles) {
    return '';
  }

  const designStyle = useMemo(() => designStyleService.wrapStyles(styles, key), [designStyleService, styles, key]);

  return designStyle;
}

export const useLatest = <T>(value: T): { readonly current: T } => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

export const useAutorun = <T>(observable: IObservable<T>): T => {
  const [value, setValue] = useState<T>(observable.get());

  useDisposable(
    () =>
      autorun((reader) => {
        setValue(observable.read(reader));
      }),
    [observable],
  );

  return value;
};
