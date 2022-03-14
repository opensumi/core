import { Injectable } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Domain } from '@opensumi/ide-core-browser';

import { MenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution)
export class MenuBarContribution implements ComponentContribution {
  // Component key
  static MenuBarContainer = '@opensumi/menu-bar-example';

  registerComponent(registry: ComponentRegistry): void {
    registry.register(MenuBarContribution.MenuBarContainer, {
      component: MenuBarView,
      id: MenuBarContribution.MenuBarContainer,
    });
  }
}
