import { Injectable, Autowired } from '@ali/common-di';
import { Event, IDisposable } from '@ali/ide-core-common';
import { IMenuRegistry, MenuId, IMenuItem } from '../../menu/next';

export const TabBarToolbarContribution = Symbol('TabBarToolbarContribution');
export interface TabBarToolbarContribution {

  registerToolbarItems(registry: ToolbarRegistry): void;

}

@Injectable()
export class ToolbarRegistry {
  @Autowired(IMenuRegistry)
  menuRegistry: IMenuRegistry;

  registerItem(item: TabBarToolbarItem): IDisposable {
    return this.menuRegistry.registerMenuItem(MenuId.ViewTitle, {
      ...item,
      when: item.when || `view == ${item.viewId}`,
      group: item.group || 'navigation',
    } as IMenuItem);
  }
}

export interface TabBarToolbarItem extends IMenuItem {
  readonly id: string;
  readonly tooltip?: string;

  readonly label?: string;

  viewId?: string;

  readonly onDidChange?: Event<void>;

}
