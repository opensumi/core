import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService, SlotLocation } from '@ali/ide-main-layout';
import { ViewContainer } from '../components';

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
export class ViewsContributionPoint extends VscodeContributionPoint<ViewsSchema> {

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  contribute() {
    for (const location of Object.keys(this.json)) {
      console.warn('TODO 存在时序问题，hanlder还未准备好');
      setTimeout(() => {
        const handler = this.mainlayoutService.getTabbarHandler(location);
        const views: ViewItem[] = this.json[location];
        for (const view of views) {
          // TODO @魁武 使用treeview
          handler!.registerView(view, ViewContainer);
        }
      }, 5000);
    }
  }

}
