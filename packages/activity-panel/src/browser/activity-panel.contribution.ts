import { Domain, ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry, TabBarToolbarContribution, TabBarToolbarRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanel } from './activity-panel.view';
import { ActivityPanelRight } from './activity-panel.right.view';
import { Autowired } from '@ali/common-di';
import { ActivityPanelBottom } from './activity-panel.bottom.view';

@Domain(ComponentContribution, ClientAppContribution)
export class ActivityPanelContribution implements ComponentContribution, ClientAppContribution {
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-activity-panel/left', {
      id: 'ide-activity-panel/left',
      component: ActivityPanel,
    });
    registry.register('@ali/ide-activity-panel/right', {
      id: 'ide-activity-panel/right',
      component: ActivityPanelRight,
    });
    registry.register('@ali/ide-activity-panel/bottom', {
      id: 'ide-activity-panel/bottom',
      component: ActivityPanelBottom,
    });
  }

  @Autowired(TabBarToolbarContribution)
  protected readonly contributionProvider: ContributionProvider<TabBarToolbarContribution>;

  @Autowired()
  private toolBarRegistry: TabBarToolbarRegistry;

  onStart() {
    const contributions = this.contributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerToolbarItems(this.toolBarRegistry);
    }
  }

}
