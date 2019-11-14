import * as React from 'react';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject, Domain } from '@ali/common-di';
import { WithEventBus, View, ViewContainerOptions } from '@ali/ide-core-browser';
import { IMainLayoutService, ComponentCollection } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { ActivityBarHandler } from '@ali/ide-activity-bar/lib/browser/activity-bar-handler';
import { TabbarService } from './tabbar/tabbar.service';

@Injectable()
export class LayoutService extends WithEventBus {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  tabbarComponents: ComponentCollection[] = [];
  toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void {

  }

  isVisible(location: string): boolean {
    return true;
  }

  restoreState(): void {

  }

  getTabbarService(location: string) {
    const service = this.services.get(location) || this.injector.get(TabbarService, [location]);
    if (!this.services.get(location)) {
      this.services.set(location, service);
    }
    return service;
  }

  getTabbarHandler(containerId: string): TabBarHandler {
    let activityHandler = this.handleMap.get(containerId);
    if (!activityHandler) {
      let location: string | undefined;
      for (const service of this.services.values()) {
        if (service.getContainer(containerId)) {
          location = service.location;
          break;
        }
      }
      if (location) {
        activityHandler = this.injector.get(TabBarHandler, [containerId, this.getTabbarService(location)]);
        this.handleMap.set(containerId, activityHandler);
      } else {
        console.error('没有找到该container对应的tabbar！');
      }
    }
    return activityHandler!;
  }

  colectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: React.FunctionComponent<{}> | undefined): string {
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, {views, options});
    return options.containerId;
  }

  collectViewComponent(view: View, containerId: string, props?: any): string {
    return containerId;
  }

  expandBottom(expand?: boolean | undefined): void {

  }

  bottomExpanded: boolean;

}
