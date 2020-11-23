import * as React from 'react';
import { Domain, ComponentContribution, ComponentRegistry, SlotRenderer, getIcon, useInjectable } from '@ali/ide-core-browser';
import { InlineMenuBar } from '@ali/ide-core-browser/lib/components/actions';
import { Injectable } from '@ali/common-di';
import { AbstractContextMenuService, MenuRegistryImpl, IMenubarItem, NextMenuContribution, IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { IDisposable } from '@ali/ide-core-common';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export const CORE_MENU_BAR = 'kaitian/menubar';

export const ICON_MENU_ENTRY = 'kaitian/icon-menuentry';

@Domain(ComponentContribution, NextMenuContribution)
export class IconMenuBarContribution implements ComponentContribution, NextMenuContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-menu-bar', {
      id: 'ide-menu-bar',
      component: IconMenuBarMixToolbarAction,
    }, {
      size: 27,
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(ICON_MENU_ENTRY, {
      submenu: CORE_MENU_BAR,
      group: 'navigation',
      iconClass: getIcon('unorderedlist'),
      label: 'menu',
      order: 1,
    });
  }
}

@Injectable()
export class OverrideMenuRegistry extends MenuRegistryImpl {

  registerMenubarItem(menuId: string, item: PartialBy<IMenubarItem, 'id'>): IDisposable {
    const superDisposable = super.registerMenubarItem(menuId, item);
    const toDispose = this.registerMenuItem(CORE_MENU_BAR, Object.assign({submenu: menuId}, item));
    return {
      dispose: () => {
        superDisposable.dispose();
        toDispose.dispose();
      },
    };
  }

}

export const IconMenuBarMixToolbarAction = () => {
  const contextMenuService = useInjectable(AbstractContextMenuService);
  const menus = React.useMemo(() => {
    return contextMenuService.createMenu({
      id: ICON_MENU_ENTRY,
    });
  }, []);

  return <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
    <InlineMenuBar menus={menus} />
    <SlotRenderer slot='action' flex={1} overflow={'initial'} />
  </div>;
};
