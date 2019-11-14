import * as React from 'react';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject, Domain } from '@ali/common-di';
import { WithEventBus, View, ViewContainerOptions, ContributionProvider } from '@ali/ide-core-browser';
import { IMainLayoutService, ComponentCollection, MainLayoutContribution } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { ActivityBarHandler } from '@ali/ide-activity-bar/lib/browser/activity-bar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';

@Injectable()
export class LayoutService extends WithEventBus {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  private pendingViewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  constructor() {
    super();
    setTimeout(() => {
      // TODO rendered contribution
      for (const contribution of this.contributions.getContributions()) {
        if (contribution.onDidUseConfig) {
          contribution.onDidUseConfig();
        }
      }
      for (const [containerId, views] of this.pendingViewsMap.entries()) {
        views.forEach(({view, props}) => {
          this.collectViewComponent(view, containerId, props);
        });
      }
    }, 3000);
  }

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
        console.error(`没有找到${containerId}对应的tabbar！`);
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
    const accordion = this.viewContainerRegistry.getAccordion(containerId);
    if (accordion) {
      accordion.addWidget(view, props);
    } else {
      const items = this.pendingViewsMap.get(containerId);
      items ? items.push({view, props}) : this.pendingViewsMap.set(containerId, [{view, props}]);
    }
    return containerId;
  }

  expandBottom(expand?: boolean | undefined): void {

  }

  bottomExpanded: boolean;

}
