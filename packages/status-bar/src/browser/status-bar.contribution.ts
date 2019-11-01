import { Domain } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { StatusBarView } from './status-bar.view';

@Domain(ComponentContribution)
export class StatusBarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-status-bar', {
      component: StatusBarView,
      id: 'ide-status-bar',
    }, {
      size: 28,
    });
  }
}
