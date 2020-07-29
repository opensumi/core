import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ContextKeyChangeEvent, Event, WithEventBus, View, ViewContainerOptions, ContributionProvider, SlotLocation, IContextKeyService, ExtensionActivateEvent, AppConfig, ComponentRegistry, Logger } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import { IMenuRegistry, AbstractContextMenuService, MenuId, AbstractMenuService, IContextMenu } from '@ali/ide-core-browser/lib/menu/next';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import { AccordionService } from './accordion/accordion.service';
import debounce = require('lodash.debounce');
import { Deferred } from '@ali/ide-core-common/lib';

@Injectable()
export class LayoutService extends WithEventBus implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(ComponentRegistry)
  private componentRegistry: ComponentRegistry;

  @Autowired(Logger)
  private logger: Logger;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  private accordionServices: Map<string, AccordionService> = new Map();

  private pendingViewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  private viewToContainerMap: Map<string, string> = new Map();

  private state: {[location: string]: {
    currentId?: string;
    size?: number;
  }} = {};

  private viewWhenContextkeys = new Set<string>();
  private customViewSet = new Set<View>();
  private allViews = new Map<string, View>();

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  protected contextmenuService: AbstractContextMenuService;

  public viewReady: Deferred<void> = new Deferred();

  constructor() {
    super();
  }

  didMount() {
    for (const [containerId, views] of this.pendingViewsMap.entries()) {
      views.forEach(({view, props}) => {
        this.collectViewComponent(view, containerId, props);
      });
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidRender) {
        contribution.onDidRender();
      }
    }
    this.restoreState();
    this.addDispose(Event.debounce<ContextKeyChangeEvent, boolean>(
      this.contextKeyService.onDidChangeContext,
      (last, event) =>  last || event.payload.affectsSome(this.viewWhenContextkeys),
      50,
    )((e) => e && this.handleContextKeyChange(), this));
    this.viewReady.resolve();
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
    for (const service of this.services.values()) {
      const {currentId, size} = this.state[service.location] || {};
      service.prevSize = size;
      let defaultContainer = service.visibleContainers[0] && service.visibleContainers[0].options!.containerId;
      const defaultPanels = this.appConfig.defaultPanels;
      if (defaultPanels && defaultPanels[service.location] !== undefined) {
        if (defaultPanels[service.location]) {
          const componentInfo = this.componentRegistry.getComponentRegistryInfo(defaultPanels[service.location]);
          if (componentInfo) {
            defaultContainer = componentInfo.options!.containerId;
          } else {
            this.logger.warn(`[defaultPanels] 没有找到${defaultPanels[service.location]}对应的视图!`);
          }
        } else {
          defaultContainer = '';
        }
      }
      if (currentId === undefined) {
        service.currentContainerId = defaultContainer;
      } else {
        service.currentContainerId = currentId ? (service.containersMap.has(currentId) ? currentId : defaultContainer) : '';
      }
    }
  }

  isVisible(location: string) {
    const tabbarService = this.getTabbarService(location);
    return !!tabbarService.currentContainerId;
  }

  toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void {
    const tabbarService = this.getTabbarService(location);
    if (!tabbarService) {
      // tslint:disable-next-line no-console
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

  // TODO: noAccordion应该由视图决定，service不需要关心
  getTabbarService(location: string, noAccordion?: boolean) {
    const service = this.services.get(location) || this.injector.get(TabbarService, [location, noAccordion]);
    if (!this.services.get(location)) {
      service.onCurrentChange(({currentId}) => {
        this.storeState(service, currentId);
        if (currentId && !service.noAccordion) {
          const accordionService = this.getAccordionService(currentId);
          accordionService.expandedViews.forEach((view) => {
            this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onView', data: view.id }));
          });
        }
      });
      service.onSizeChange(() => debounce(() => this.storeState(service, service.currentContainerId), 200)());
      this.services.set(location, service);
    }
    return service;
  }

  getAccordionService(containerId: string, noRestore?: boolean) {
    let service = this.accordionServices.get(containerId);
    if (!service) {
      service = this.injector.get(AccordionService, [containerId, noRestore]);
      this.accordionServices.set(containerId, service);
    }
    return service;
  }

  getTabbarHandler(viewOrContainerId: string): TabBarHandler | undefined {
    let handler = this.doGetTabbarHandler(viewOrContainerId);
    if (!handler) {
      const containerId = this.viewToContainerMap.get(viewOrContainerId);
      if (!containerId) {
        // tslint:disable-next-line no-console
        console.warn(`没有找到${viewOrContainerId}对应的tabbar！`);
      }
      handler = this.doGetTabbarHandler(containerId || '');
    }
    return handler;
  }

  getExtraMenu(): IContextMenu {
    return this.contextmenuService.createMenu({
      id: MenuId.ActivityBarExtra,
    });
  }

  protected doGetTabbarHandler(containerId: string) {
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
      }
    }
    return activityHandler;
  }

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: any): string {
    if (Fc) {
      // tslint:disable-next-line no-console
      console.warn('collectTabbarComponent api warning: Please move react component into options.component!');
    }
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, {views, options});
    views.forEach((view) => {
      this.viewToContainerMap.set(view.id, options.containerId);
    });
    return options.containerId;
  }

  collectViewComponent(view: View, containerId: string, props?: any): string {
    this.allViews.set(view.id, view);
    this.viewToContainerMap.set(view.id, containerId);
    if (view.when) {
      this.fillKeysInWhenExpr(this.viewWhenContextkeys, view.when);
      this.customViewSet.add(view);
      if (!this.contextKeyService.match(view.when)) {
        return view.id;
      }
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    if (props) {
      view.initialProps = props;
    }
    accordionService.appendView(view);
    return containerId;
  }

  replaceViewComponent(view: View, props?: any) {
    const containerId = this.viewToContainerMap.get(view.id);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${view.id}对应的容器，请检查传入参数!`);
      return;
    }
    const contributedView = this.allViews.get(view.id);
    if (contributedView) {
      view = Object.assign(contributedView, view);
    }

    this.collectViewComponent(view, containerId!, props);
  }

  disposeViewComponent(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${viewId}对应的容器，请检查传入参数!`);
      return;
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    accordionService.disposeView(viewId);
  }

  disposeContainer(containerId: string) {
    let location: string | undefined;
    for (const service of this.services.values()) {
      if (service.getContainer(containerId)) {
        location = service.location;
        break;
      }
    }
    if (location) {
      const tabbarService = this.getTabbarService(location);
      tabbarService.disposeContainer(containerId);
    } else {
      // tslint:disable-next-line no-console
      console.warn('没有找到containerId所属Tabbar!');
    }
  }

  // TODO 这样很耦合，不能做到tab renderer自由拆分
  expandBottom(expand: boolean): void {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    tabbarService.doExpand(expand);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
  }

  get bottomExpanded(): boolean {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
    return tabbarService.isExpanded;
  }

  private handleContextKeyChange() {
    this.customViewSet.forEach((view) => {
      const targetContainerId = this.viewToContainerMap.get(view.id)!;
      if (this.contextKeyService.match(view.when)) {
        this.collectViewComponent(view, targetContainerId);
      }
    });
  }

  private fillKeysInWhenExpr(set: Set<string>, when?: string) {
    const keys = this.contextKeyService.getKeysInWhen(when);
    keys.forEach((key) => {
      set.add(key);
    });
  }
}
