import { Autowired } from '@opensumi/di';
import { ToolBarActionContribution, AppConfig, IToolbarRegistry } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';

import { MenuBarMixToolbarAction } from './menu-bar.view';
import { ToolbarAction } from './toolbar-action.view';


@Domain(ComponentContribution, ToolBarActionContribution)
export class MenuBarContribution implements ComponentContribution, ToolBarActionContribution {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@opensumi/ide-menu-bar',
      {
        id: 'ide-menu-bar',
        component: MenuBarMixToolbarAction,
      },
      {
        size: 27,
      },
    );

    if (!this.appConfig.isElectronRenderer) {
      registry.register('@opensumi/ide-toolbar-action', {
        id: 'ide-toolbar-action',
        component: ToolbarAction,
      });
    }
  }

  registerToolbarActions(registry: IToolbarRegistry) {
    if (!this.appConfig.isElectronRenderer) {
      registry.addLocation('menu-right');
      registry.addLocation('menu-left');
    }
  }
}
