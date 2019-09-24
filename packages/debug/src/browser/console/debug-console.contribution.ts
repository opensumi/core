import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry, Logger } from '@ali/ide-core-browser';
import { DebugConsoleView } from '../view/debug-console.view';

@Domain(ComponentContribution)
export class DebugConsoleContribution implements ComponentContribution {

  @Autowired()
  logger: Logger;

  registerComponent(registry: ComponentRegistry) {
    registry.register('debug-console', {
      id: 'debug-console',
      component: DebugConsoleView,
    }, {
      title: 'DEBUG CONSOLE',
      weight: 8,
      containerId: 'debug-console',
    });
  }
}
