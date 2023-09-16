
import { Injectable } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Domain, getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { MenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution, MenuContribution)
export class MenuBarContribution implements ComponentContribution, MenuContribution {
  static MenuBarContainer = 'menubar';

  registerComponent(registry: ComponentRegistry): void {
    registry.register(MenuBarContribution.MenuBarContainer, {
      component: MenuBarView,
      id: MenuBarContribution.MenuBarContainer,
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItems(MenuId.IconMenubarContext, [
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('layout-sidebar-left-off'),
      },
    ]);
  }
}
