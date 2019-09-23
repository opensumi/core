import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { ExtensionTabbarView } from '../../components';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { DisposableCollection } from '@ali/ide-core-node';

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

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  private disposableCollection: DisposableCollection;

  contribute() {
    for (const location of Object.keys(this.json)) {
      const views = this.json[location].map((view) => {
        return {
          ...view,
          component: ExtensionTabbarView,
        };
      });
      for (const view of views) {
        const hanlderId = this.mainlayoutService.collectViewComponent(view, location);
        this.disposableCollection.push({
          dispose: () => {
            const handler = this.mainlayoutService.getTabbarHandler(hanlderId);
            handler.disposeView(view.id);
          },
        });
      }
    }
  }

  dispose() {
    this.disposableCollection.dispose();
  }

}
