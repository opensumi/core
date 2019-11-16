import * as React from 'react';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject, Domain } from '@ali/common-di';
import { WithEventBus, View, ViewContainerOptions, ContributionProvider, OnEvent, RenderedEvent, SlotLocation } from '@ali/ide-core-browser';
import { IMainLayoutService, ComponentCollection, MainLayoutContribution } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { ActivityBarHandler } from '@ali/ide-activity-bar/lib/browser/activity-bar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';
import { IMenuRegistry, MenuService, ICtxMenuRenderer, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';

@Injectable()
export class LayoutService extends WithEventBus {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired(MenuService)
  private readonly menuService: MenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired()
  layoutState: LayoutState;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  private pendingViewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  private state: {[location: string]: {
    currentId?: string;
    size?: number;
  }} = {};

  constructor() {
    super();
  }

  @OnEvent(RenderedEvent)
  didMount() {
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
    this.restoreState();
    // TODO 暂不记录状态，激活首个
    for (const service of this.services.values()) {
      const {currentId, size} = this.state[service.location];
      service.prevSize = size;
      service.currentContainerId = currentId !== undefined ? currentId : service.containersMap.keys().next().value;
    }
  }

  storeState(service: TabbarService, currentId: string) {
    this.state[service.location] = {
      currentId,
      size: service.prevSize,
    };
    this.layoutState.setState(LAYOUT_STATE.MAIN, this.state);
  }

  restoreState() {
    this.state = this.layoutState.getState(LAYOUT_STATE.MAIN, {
      [SlotLocation.left]: {
        currentId: undefined,
        size: undefined,
      },
      [SlotLocation.right]: {
        currentId: '',
        size: undefined,
      },
    });
  }

  toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void {
    const tabbarService = this.getTabbarService(location);
    if (!tabbarService) {
      console.error(`没有找到${location}对应位置的TabbarService，无法切换面板`);
      return;
    }
    if (show === true) {
      tabbarService.currentContainerId = tabbarService.currentContainerId || tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    } else if (show === false) {
      tabbarService.currentContainerId = '';
    } else {
      tabbarService.currentContainerId = tabbarService.currentContainerId ? '' : tabbarService.previousContainerId;
    }
  }

  isVisible(location: string): boolean {
    return true;
  }

  getTabbarService(location: string) {
    const service = this.services.get(location) || this.injector.get(TabbarService, [location]);
    if (!this.services.get(location)) {
      service.onCurrentChange(({previousId, currentId}) => {
        this.storeState(service, currentId);
      });
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

  handleSetting = (event: React.MouseEvent<HTMLElement>) => {
    const menus = this.menuService.createMenu(MenuId.SettingsIconMenu);
    const menuNodes = generateCtxMenu({ menus });
    this.contextMenuRenderer.show({ menuNodes: menuNodes[1], anchor: {
      x: event.clientX,
      y: event.clientY,
    } });
  }

  expandBottom(expand?: boolean | undefined): void {

  }

  bottomExpanded: boolean;

}
