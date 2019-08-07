import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService, SlotLocation } from '@ali/ide-main-layout';
import { ViewContainer } from '../components';

import * as React from 'react';

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
          // icon: new Path(this.extension.path).join(this.json[location].icon),
        }, SlotLocation.left);
      }
    }
  }

}
