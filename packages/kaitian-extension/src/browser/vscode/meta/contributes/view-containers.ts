// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Path } from '@ali/ide-core-common/lib/path';
import { URI } from '@ali/ide-core-common';
import { SlotLocation } from '@ali/ide-core-browser';
import { ViewRegistry } from '../../view-registry';

export interface ViewContainersContribution {
  [key: string]: ViewContainerItem;
}

export interface ViewsContribution {
  [key: string]: {
    id: string;
    name: string;
    when: string
  };
}

export interface ViewContainerItem {
  id: string;
  title: string;
  icon: string;
}

export type ViewContainersSchema = Array<ViewContainersContribution>;

@Injectable()
@Contributes('viewsContainers')
export class ViewContainersContributionPoint extends VSCodeContributePoint<ViewContainersSchema> {

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  @Autowired()
  viewRegistry: ViewRegistry;

  contribute() {
    for (const location of Object.keys(this.json)) {
      if (location === 'activitybar') {
        this.mainlayoutService.registerTabbarViewToContainerMap(this.getViewsMap(this.contributes));
        for (const container of this.json[location]) {
          this.viewRegistry.registerContainer(container.id, {
            icon: URI.file(new Path(this.extension.path).join(container.icon.replace(/^\.\//, '')).toString()),
            title: container.title,
            containerId: container.id,
          });
        }
      }
    }
  }

  getViewsMap(contributes: any) {
    const views = contributes.views;
    const map = {};
    if (views) {
      for (const containerId of Object.keys(views)) {
        if (views[containerId] && Array.isArray(views[containerId])) {
          map[containerId] = views[containerId].map((view) => {
            return view.id;
          });
        }
      }
    }
    return map;
  }

}
