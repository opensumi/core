import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry, Logger } from '@ali/ide-core-browser';
import { DebugConsoleView } from '../view/debug-console.view';
import { MainLayoutContribution, IMainLayoutService } from '@ali/ide-main-layout';
import { DebugConsoleToolbarView } from '../view/debug-console-toolbar.view';

@Domain(ComponentContribution, MainLayoutContribution)
export class DebugConsoleContribution implements ComponentContribution, MainLayoutContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('debug-console', {
      id: 'debug-console-view',
      component: DebugConsoleView,
    }, {
      title: 'DEBUG CONSOLE',
      weight: 8,
      containerId: 'debug-console-container',
    });
  }

  onDidUseConfig() {
    const handler = this.layoutService.getTabbarHandler('debug-console-container');
    if (handler) {
      handler.setTitleComponent(DebugConsoleToolbarView);
    }
  }
}
