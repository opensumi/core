import { VscodeContributionPoint, Contributes } from './common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService, SlotLocation } from '@ali/ide-main-layout';
import { Path } from '@ali/ide-core-common/lib/path';

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
    // console.log(this.json);
    // for (const location of Object.keys(this.json)) {
    //   if (location === 'activitybar') {
    //     this.mainlayoutService.registerTabbarComponent({
    //       component: null,
    //       title: this.json[location].title,
    //       icon: new Path(this.extension.path).join(this.json[location].icon),
    //     }, SlotLocation.left);
    //   }
    // }
  }
}
