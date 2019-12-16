import { Injectable, Autowired } from '@ali/common-di';
import { Event, IDisposable } from '@ali/ide-core-common';
import { IMenuRegistry } from '../../menu/next';

export const TabBarToolbarContribution = Symbol('TabBarToolbarContribution');
export interface TabBarToolbarContribution {

  registerToolbarItems(registry: ToolbarRegistry): void;

}

@Injectable()
export class ToolbarRegistry {
  @Autowired(IMenuRegistry)
  menuRegistry: IMenuRegistry;

  registerItem(item: TabBarToolbarItem): IDisposable {
    return this.menuRegistry.registerMenuItem(`container/${item.viewId}`, {
      command: item.command,
      when: item.when,
      toggledWhen: item.toggleWhen,
      group: item.group || 'navigation',
      label: item.label,
    });
  }
}

export interface TabBarToolbarItem {

  readonly id: string;

  readonly command: string;

  readonly iconClass?: string;

  readonly priority?: number;

  readonly group?: string;

  readonly tooltip?: string;

  readonly label?: string;

  when?: string;

  toggleWhen?: string;

  viewId?: string;

  readonly onDidChange?: Event<void>;

}
