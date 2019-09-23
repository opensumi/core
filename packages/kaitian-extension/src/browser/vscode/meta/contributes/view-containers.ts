// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { Path } from '@ali/ide-core-common/lib/path';
import { URI, DisposableCollection } from '@ali/ide-core-common';

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

  private disposableCollection: DisposableCollection;

  contribute() {
    for (const location of Object.keys(this.json)) {
      if (location === 'activitybar') {
        this.mainlayoutService.registerTabbarViewToContainerMap(this.getViewsMap(this.contributes));
        for (const container of this.json[location]) {
          const handlerId = this.mainlayoutService.collectTabbarComponent([], {
            icon: URI.file(new Path(this.extension.path).join(container.icon.replace(/^\.\//, '')).toString()),
            title: container.title,
            containerId: container.id,
          }, 'left');
          this.disposableCollection.push({
            dispose: () => {
              const handler = this.mainlayoutService.getTabbarHandler(handlerId);
              handler.dispose();
            },
          });
        }
      }
    }
  }

  dispose() {
    this.disposableCollection.dispose();
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
