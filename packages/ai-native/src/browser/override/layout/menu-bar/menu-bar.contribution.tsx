
import { Injectable } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Domain, getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { AiMenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution, MenuContribution)
export class AiMenuBarContribution implements ComponentContribution, MenuContribution {
  static AiMenuBarContainer = 'ai-menubar';

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AiMenuBarContribution.AiMenuBarContainer, {
      component: AiMenuBarView,
      id: AiMenuBarContribution.AiMenuBarContainer,
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
