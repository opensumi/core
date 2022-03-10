import { Injectable, Autowired } from '@opensumi/di';
import { DisposableCollection } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IIconService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes } from '../../../common';

export interface ViewContainersContribution {
  [key: string]: ViewContainerItem;
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

  @Autowired(IIconService)
  iconService: IIconService;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  contribute() {
    for (const location of Object.keys(this.json)) {
      if (location === 'activitybar') {
        for (const container of this.json[location]) {
          const handlerId = this.mainlayoutService.collectTabbarComponent(
            [],
            {
              iconClass: this.iconService.fromIcon(this.extension.path, container.icon),
              title: this.getLocalizeFromNlsJSON(container.title),
              containerId: container.id,
              // 插件注册的视图默认在最后
              priority: 0,
              fromExtension: true,
              // 插件注册的视图容器无view时默认都隐藏tab
              hideIfEmpty: true,
            },
            'left',
          );
          this.disposableCollection.push({
            dispose: () => {
              const handler = this.mainlayoutService.getTabbarHandler(handlerId);
              handler?.dispose();
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
    const map: { [containerId: string]: string[] } = {};
    if (views) {
      for (const containerId of Object.keys(views)) {
        if (views[containerId] && Array.isArray(views[containerId])) {
          map[containerId] = views[containerId].map((view) => view.id);
        }
      }
    }

    return map;
  }
}
