import { VSCodeContributePoint, Contributes } from '../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { WelcomeView } from '@ali/ide-main-layout/lib/browser/welcome.view';
import { DisposableCollection } from '@ali/ide-core-browser';

export interface ViewsContribution {
  [key: string]: ViewItem;
}

export interface ViewItem {
  id: string;
  name: string;
  when: string;
  weight?: number;
  priority?: number;
}

export type ViewsSchema = Array<ViewsContribution>;

@Injectable()
@Contributes('views')
export class ViewsContributionPoint extends VSCodeContributePoint<ViewsSchema> {

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  contribute() {
    for (const location of Object.keys(this.json)) {
      const views = this.json[location].map((view) => {
        return {
          ...view,
          name: this.getLocalizeFromNlsJSON(view.name),
          component: WelcomeView,
        };
      });
      for (const view of views) {
        const handlerId = this.mainlayoutService.collectViewComponent(view, location, {viewId: view.id}, {
          fromExtension: true,
        });
        this.disposableCollection.push({
          dispose: () => {
            const handler = this.mainlayoutService.getTabbarHandler(handlerId)!;
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
