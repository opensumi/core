import { Domain } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivatorPanel } from './activator-panel.view';
import { ActivatorPanelRight } from './activator-panel.right.view';

@Domain(LayoutContribution)
export class ActivatorPanelContribution implements LayoutContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activator-panel/left', {
      component: ActivatorPanel,
    });
    registry.register('@ali/ide-activator-panel/right', {
      component: ActivatorPanelRight,
    });
  }
}
