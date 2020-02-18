import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';

import { MenuBar } from './menu-bar.view';

@Domain(ComponentContribution)
export class MenuBarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-menu-bar', {
      id: 'ide-menu-bar',
      component: MenuBar,
    }, {
      size: 27,
    });
  }

  registerCommands(): void {
  }
}
