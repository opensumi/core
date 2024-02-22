import { Autowired, Injectable } from '@opensumi/di';
import { Event, IDisposable } from '@opensumi/ide-core-common';

import { IMenuItem, IMenuRegistry } from '../../menu/next/base';
import { MenuId } from '../../menu/next/menu-id';

export const TabBarToolbarContribution = Symbol('TabBarToolbarContribution');
export interface TabBarToolbarContribution {
  registerToolbarItems(registry: ToolbarRegistry): void;
}

@Injectable()
export class ToolbarRegistry {
  @Autowired(IMenuRegistry)
  menuRegistry: IMenuRegistry;

  /**
   *
   *
   * @param {TabBarToolbarItem} item
   * @returns {IDisposable}
   * @memberof ToolbarRegistry
   */
  registerItem(item: TabBarToolbarItem): IDisposable {
    if (typeof item.command === 'string') {
      const label = item.tooltip || item.label;
      if (label) {
        item.command = {
          id: item.command,
          label,
        };
      }
    }
    return this.menuRegistry.registerMenuItem(MenuId.ViewTitle, {
      ...item,
      when: `${item.when ? item.when + ' && ' : ''}view == ${item.viewId}`,
      group: item.group || 'navigation',
    } as IMenuItem);
  }

  /**
   * 取消已注册的菜单项
   * @param menuItemId
   */
  unregisterItem(menuItemId: string) {
    this.menuRegistry.unregisterMenuItem(MenuId.ViewTitle, menuItemId);
  }
}

export interface TabBarToolbarItem extends IMenuItem {
  readonly id: string;
  readonly tooltip?: string;

  readonly label?: string;

  viewId?: string;

  readonly onDidChange?: Event<void>;
}
