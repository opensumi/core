import { Domain } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivatorBar } from './activator-bar.view';

@Domain(LayoutContribution)
export class ActivatorBarContribution implements LayoutContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activator-bar', {
      component: ActivatorBar,
    });
  }
}
