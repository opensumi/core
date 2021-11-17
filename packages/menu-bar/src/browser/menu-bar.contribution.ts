import { Domain } from '@ide-framework/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry } from '@ide-framework/ide-core-browser/lib/layout';

import { MenuBarMixToolbarAction } from './menu-bar.view';
import { ToolbarAction } from './toolbar-action.view';
import { ToolBarActionContribution, isElectronEnv, IToolbarRegistry } from '@ide-framework/ide-core-browser';

@Domain(ComponentContribution, ToolBarActionContribution)
export class MenuBarContribution implements ComponentContribution, ToolBarActionContribution {

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ide-framework/ide-menu-bar', {
      id: 'ide-menu-bar',
      component: MenuBarMixToolbarAction,
    }, {
      size: 27,
    });

    if (!isElectronEnv()) {
      registry.register('@ide-framework/ide-toolbar-action', {
        id: 'ide-toolbar-action',
        component: ToolbarAction,
      });
    }
  }

  registerToolbarActions(registry: IToolbarRegistry) {
    if (!isElectronEnv()) {
      registry.addLocation('menu-right');
      registry.addLocation('menu-left');
    }
  }
}
