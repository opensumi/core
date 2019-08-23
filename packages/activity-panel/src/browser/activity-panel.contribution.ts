import { Domain, ClientAppContribution, ContributionProvider } from '@ali/ide-core-browser';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanel } from './activity-panel.view';
import { ActivityPanelRight } from './activity-panel.right.view';
import { Autowired } from '@ali/common-di';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from './tab-bar-toolbar';

@Domain(LayoutContribution, ClientAppContribution)
export class ActivityPanelContribution implements LayoutContribution, ClientAppContribution {
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
