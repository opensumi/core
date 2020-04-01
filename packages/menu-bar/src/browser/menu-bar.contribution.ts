import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';

import { MenuBar } from './menu-bar.view';
import { ToolbarAction } from './toolbar-action.view';

@Domain(ComponentContribution)
export class MenuBarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-menu-bar', {
      id: 'ide-menu-bar',
      component: MenuBar,
    }, {
      size: 27,
    });

    registry.register('@ali/ide-toolbar-action', {
      id: 'ide-toolbar-action',
      component: ToolbarAction,
    });
  }
}
