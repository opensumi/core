import * as React from 'react';
import { DisposableStore } from '@ali/ide-core-common';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { splitMenuItems } from '@ali/ide-core-browser/lib/menu/next/menu-util';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import Icon from '@ali/ide-core-browser/lib/components/icon';

import { ISCMResource, ISCMResourceGroup } from '../../common';
import { SCMMenus } from '../scm-menu';

export const SCMActionBar: React.FC<{
  context: ISCMResourceGroup | ISCMResource;
  menuService: SCMMenus;
  resourceGroup: ISCMResourceGroup;
}> = ({ menuService, resourceGroup, context }) => {
  const [menuConfig, setMenuConfig] = React.useState<MenuNode[]>([]);

  function updateMenuConfig(menus: IMenu) {
    const menuNodes = menus.getMenuNodes();
    // fixme: 类型问题
    const [inlineActions] = splitMenuItems(menuNodes as any, 'inline');
    setMenuConfig(inlineActions);
  }

  React.useEffect(() => {
    const disposables = new DisposableStore();

    const menus = menuService.getResourceMenu(resourceGroup);
    updateMenuConfig(menus as any);

    disposables.add(menus);
    disposables.add(menus.onDidChange(() => {
      updateMenuConfig(menus as any);
    }));
    return () => {
      disposables.dispose();
    };
  }, [ menuService, resourceGroup ]);

  const handleClick = React.useCallback((config: MenuNode) => {
    return config.execute(context);
  }, [context]);

  return <>
    {
      menuConfig.map((config) => (
        <Icon
          key={config.id}
          title={config.label}
          iconClass={config.icon}
          onClick={handleClick.bind(null, config)}
        />
      ))
    }
  </>;
};
