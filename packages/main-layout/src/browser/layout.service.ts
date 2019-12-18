import * as React from 'react';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WithEventBus, View, ViewContainerOptions, ContributionProvider, OnEvent, RenderedEvent, SlotLocation, IContextKeyService } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import { IMenuRegistry, AbstractContextMenuService, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import './main-layout.less';
import { AccordionService } from './accordion/accordion.service';
import debounce = require('lodash.debounce');
import { ActivationEventService } from '@ali/ide-activation-event';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';

@Injectable()
export class LayoutService extends WithEventBus implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired(AbstractContextMenuService)
  private readonly ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(IContextKeyService)
  private ctxKeyService: IContextKeyService;

  @Autowired(ActivationEventService)
  private activationEventService: ActivationEventService;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  private accordionServices: Map<string, AccordionService> = new Map();

  private pendingViewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  private state: {[location: string]: {
    currentId?: string;
    size?: number;
  }} = {};

  // TODO 使用IconAction完成左侧activityBar上展示的额外图标注册能力
  // private extraIconActions: IconAction

  constructor() {
    super();
  }

  @OnEvent(RenderedEvent)
  didMount() {
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidRender) {
        contribution.onDidRender();
      }
    }
    for (const [containerId, views] of this.pendingViewsMap.entries()) {
      views.forEach(({view, props}) => {
        this.collectViewComponent(view, containerId, props);
      });
    }
    this.restoreState();
    for (const service of this.services.values()) {
      const {currentId, size} = this.state[service.location] || {};
      service.prevSize = size;
      service.currentContainerId = currentId !== undefined ? currentId : service.containersMap.keys().next().value;
    }
  }

  setFloatSize(size: number) {}

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
      [SlotLocation.bottom]: {
        currentId: undefined,
        size: undefined,
      },
    });
  }

  isVisible(location: string) {
    const tabbarService = this.getTabbarService(location);
    return !!tabbarService.currentContainerId;
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
      tabbarService.currentContainerId = tabbarService.currentContainerId ? '' : tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    }
    if (tabbarService.currentContainerId && size) {
      tabbarService.resizeHandle.setSize(size);
    }
  }

  getTabbarService(location: string, noAccordion?: boolean) {
    const service = this.services.get(location) || this.injector.get(TabbarService, [location, noAccordion]);
    if (!this.services.get(location)) {
      service.onCurrentChange(({previousId, currentId}) => {
        this.storeState(service, currentId);
        if (currentId && !service.noAccordion) {
          const accordionService = this.getAccordionService(currentId);
          accordionService.expandedViews.forEach((view) => {
            this.activationEventService.fireEvent(`onView:${view.id}`);
          });
        }
      });
      service.onSizeChange(({size}) => debounce(() => this.storeState(service, service.currentContainerId), 200)());
      this.services.set(location, service);
    }
    return service;
  }

  getAccordionService(containerId: string) {
    let service = this.accordionServices.get(containerId);
    if (!service) {
      service = this.injector.get(AccordionService, [containerId]);
      this.accordionServices.set(containerId, service);
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

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: any): string {
    if (Fc) {
      console.warn('collectTabbarComponent api warning: Please move react component into options.component!');
    }
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, {views, options});
    return options.containerId;
  }

  collectViewComponent(view: View, containerId: string, props?: any): string {
    const accordionService: AccordionService = this.getAccordionService(containerId);
    if (props) {
      view.initialProps = props;
    }
    accordionService.appendView(view);
    return containerId;
  }

  handleSetting = (event: React.MouseEvent<HTMLElement>) => {
    const menus = this.ctxMenuService.createMenu({
      id: MenuId.SettingsIconMenu,
    });
    const menuNodes = menus.getGroupedMenuNodes();
    menus.dispose();
    this.contextMenuRenderer.show({ menuNodes: menuNodes[1], anchor: {
      x: event.clientX,
      y: event.clientY,
    } });
  }

  // TODO 这样很耦合，不能做到tab renderer自由拆分
  expandBottom(expand: boolean): void {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    tabbarService.doExpand(expand);
    this.ctxKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
  }

  get bottomExpanded(): boolean {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    this.ctxKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
    return tabbarService.isExpanded;
  }

}
