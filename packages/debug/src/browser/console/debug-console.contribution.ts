import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { localize, ComponentContribution, ComponentRegistry, Logger } from '@ali/ide-core-browser';
import { DebugConsoleView } from '../view/debug-console.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { DebugConsoleToolbarView } from '../view/debug-console-toolbar.view';
import { DebugContribution } from '../debug-contribution';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

export const DEBUG_CONSOLE_VIEW_ID = 'debug-console-view';

@Domain(ComponentContribution, MainLayoutContribution)
export class DebugConsoleContribution implements ComponentContribution, MainLayoutContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('debug-console', {
      id: DEBUG_CONSOLE_VIEW_ID,
      component: DebugConsoleView,
    }, {
      title: localize('debug.console.panel.title'),
      priority: 8,
      containerId: DebugContribution.DEBUG_CONSOLE_CONTAINER_ID,
      iconClass: getIcon('debug'),
    });
  }

  onDidUseConfig() {
    const handler = this.layoutService.getTabbarHandler('debug-console-container');
    if (handler) {
      handler.setTitleComponent(DebugConsoleToolbarView);
    }
  }
}
