import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { localize, ComponentContribution, ComponentRegistry, Logger } from '@ali/ide-core-browser';
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
<<<<<<< HEAD
      title: localize('debug.console.panel.title'),
      priority: 8,
=======
      title: 'DEBUG CONSOLE',
      priority: 8,
>>>>>>> 71c00891a685e24dc35c2198329377f86634ad67
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
