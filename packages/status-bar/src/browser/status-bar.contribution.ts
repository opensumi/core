import { Domain } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { StatusBarView } from './status-bar.view';

@Domain(LayoutContribution)
export class StatusBarContribution implements LayoutContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-status-bar', {
      component: StatusBarView,
      id: 'ide-status-bar',
    }, {
      size: 19,
    });
  }
}
