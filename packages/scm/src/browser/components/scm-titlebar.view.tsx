import * as React from 'react';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { splitMenuItems } from '@ali/ide-core-browser/lib/menu/next/menu-util';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import { TitleActionList } from '@ali/ide-core-browser/lib/components/actions';
import { useDisposable } from '@ali/ide-core-browser';

import { ISCMProvider } from '../../common';
import { SCMMenus } from '../scm-menu';

export const SCMTitleBar: React.FC<{
  context: ISCMProvider;
  menuService: SCMMenus;
  resourceGroup: any;
}> = ({ menuService, resourceGroup, context }) => {
  const [menuConfig, setMenuConfig] = React.useState<MenuNode[][]>([]);

  useDisposable(() => {
    const menus = menuService.getResourceInlineActions(resourceGroup);
    updateMenuConfig(menus);

    function updateMenuConfig(menus: IMenu) {
      const menuNodes = menus.getMenuNodes();
      // fixme: 类型问题
      const menuItems = splitMenuItems(menuNodes);
      setMenuConfig(menuItems);
    }

    return [
      menus,
      menus.onDidChange(() => {
        updateMenuConfig(menus);
      }),
    ];
  }, [ menuService, resourceGroup ]);

  return (
    <TitleActionList
      nav={menuConfig[0]}
      more={menuConfig[1]}
      context={context} />
  );
};
