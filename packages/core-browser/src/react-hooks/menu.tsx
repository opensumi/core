import { useState, useCallback } from 'react';

import { MenuNode, IContextMenu } from '../menu/next';
import { useDisposable } from './disposable';

export function useContextMenus(
  menuInitalizer: IContextMenu | (() => IContextMenu),
) {
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
  }, [ initalizer ]);

  return menuConfig;
}
