import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService, SlotLocation } from '@ali/ide-main-layout';
import { ViewContainer } from '../components';
import { Path } from '@ali/ide-core-common/lib/path';
import { URI } from '@ali/ide-core-node';

export interface ViewContainersContribution {
  [key: string]: {
    id: string;
    title: string;
    icon: string
  };
}

export interface ViewsContribution {
  [key: string]: {
    id: string;
    name: string;
    when: string
  };
}

export type ViewContainersSchema = Array<ViewContainersContribution>;

@Injectable()
@Contributes('viewsContainers')
export class ViewContainersContributionPoint extends VscodeContributionPoint<ViewContainersSchema> {

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  contribute() {
    for (const location of Object.keys(this.json)) {
      if (location === 'activitybar') {
        // 默认weight为0
        this.mainlayoutService.collectTabbarComponent({
          component: ViewContainer,
          title: this.json[location].title,
          iconClass: 'volans_icon webview',
          // FIXME json[location]是一个数组
          icon: URI.file(new Path(this.extension.path).join(this.json[location][0].icon.replace(/^\.\//, '')).toString()),
        }, SlotLocation.left);
      }
    }
  }

}
