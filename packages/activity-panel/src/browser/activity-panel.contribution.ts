import { Domain } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanel } from './activity-panel.view';
import { ActivityPanelRight } from './activity-panel.right.view';

@Domain(LayoutContribution)
export class ActivityPanelContribution implements LayoutContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activity-panel/left', {
      id: 'ide-activity-panel/left',
      component: ActivityPanel,
    });
    registry.register('@ali/ide-activity-panel/right', {
      id: 'ide-activity-panel/right',
      component: ActivityPanelRight,
    });
  }
}
