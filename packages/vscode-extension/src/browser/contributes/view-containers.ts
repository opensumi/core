import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService, SlotLocation } from '@ali/ide-main-layout';
import { ExtensionViewContainer, ExtensionViewContainerProps } from '../components';
import { Path } from '@ali/ide-core-common/lib/path';
import { URI } from '@ali/ide-core-common';

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
export class ViewContainersContributionPoint extends VscodeContributionPoint<ViewContainersSchema> {

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  contribute() {
    for (const location of Object.keys(this.json)) {
      if (location === 'activitybar') {
        for (const container of this.json[location]) {
          this.mainlayoutService.collectTabbarComponent([], {
            icon: URI.file(new Path(this.extension.path).join(container.icon.replace(/^\.\//, '')).toString()),
            title: container.title,
            containerId: container.id,
          }, SlotLocation.left);
        }
      }
    }
  }

  getViewProps(contributes: any, containerId: string): ExtensionViewContainerProps {
    const views = contributes.views;
    if (views) {
      if (views[containerId] && Array.isArray(views[containerId])) {
        return {
          views: views[containerId],
          containerId,
        };
      }
    }
    return {
      views: [],
      containerId,
    };
  }

}
