import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionTabbarView } from '../../components';
import { ViewRegistry } from '../../view-registry';

export interface ViewsContribution {
  [key: string]: ViewItem;
}

export interface ViewItem {
  id: string;
  name: string;
  when: string;
}

export type ViewsSchema = Array<ViewsContribution>;

@Injectable()
@Contributes('views')
export class ViewsContributionPoint extends VSCodeContributePoint<ViewsSchema> {

  @Autowired()
  viewRegistry: ViewRegistry;

  contribute() {
    for (const location of Object.keys(this.json)) {
      const views = this.json[location].map((view) => {
        return {
          ...view,
          component: ExtensionTabbarView,
        };
      });
      this.viewRegistry.registerViews(location, views);
    }
  }

}
