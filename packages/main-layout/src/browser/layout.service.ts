import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  AppConfig,
  CommandRegistry,
  CommandService,
  ComponentRegistry,
  ContributionProvider,
  ExtensionActivateEvent,
  IContextKeyService,
  IDisposable,
  ILogger,
  OnEvent,
  SlotLocation,
  View,
  ViewContainerOptions,
  WithEventBus,
  slotRendererRegistry,
} from '@opensumi/ide-core-browser';
import { Layout, fixLayout } from '@opensumi/ide-core-browser/lib/components';
import { LAYOUT_STATE, LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { ComponentRegistryInfo } from '@opensumi/ide-core-browser/lib/layout/layout.interface';
import {
  AbstractContextMenuService,
  AbstractMenuService,
  IContextMenu,
  IMenuRegistry,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { Deferred, getDebugLogger, isUndefined } from '@opensumi/ide-core-common';
import { transaction } from '@opensumi/ide-monaco/lib/common/observable';
import { ThemeChangedEvent } from '@opensumi/ide-theme';

import {
  DROP_EXTEND_VIEW_CONTAINER,
  DROP_PANEL_CONTAINER,
  DROP_VIEW_CONTAINER,
  IMainLayoutService,
  MainLayoutContribution,
  SUPPORT_ACCORDION_LOCATION,
  ViewComponentOptions,
} from '../common';

import { AccordionService } from './accordion/accordion.service';
import { TabbarService } from './tabbar/tabbar.service';
import { TabBarHandler } from './tabbar-handler';

const defaultLayoutState = {
  [SlotLocation.view]: {
    currentId: undefined,
    size: undefined,
  },
  [SlotLocation.extendView]: {
    // 依照下面的恢复逻辑，这里设置为 `''` 时，就不会恢复右侧的 TabBar 的状态（即选中相应的 viewContainer）
    currentId: '',
    size: undefined,
  },
  [SlotLocation.panel]: {
    currentId: undefined,
    size: undefined,
  },
  // 存储 Container 的移动信息：containerId -> location
  containerLocations: {},
};

@Injectable()
export class LayoutService extends WithEventBus implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(ComponentRegistry)
  private componentRegistry: ComponentRegistry;

  @Autowired(ILogger)
  private logger: ILogger;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private tabbarServices: Map<string, TabbarService> = new Map();

  private accordionServices: Map<string, AccordionService> = new Map();

  private pendingViewsMap: Map<string, { view: View; props?: any }[]> = new Map();

  private viewToContainerMap: Map<string, string> = new Map();

  private disposableMap: Map<string, IDisposable> = new Map();

  private state: {
    [location: string]: {
      currentId?: string;
      size?: number;
    };
  } = {};

  private customViews = new Map<string, View>();

  private debug = getDebugLogger();

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  protected contextmenuService: AbstractContextMenuService;

  public viewReady: Deferred<void> = new Deferred();

  didMount() {
    for (const [containerId, views] of this.pendingViewsMap.entries()) {
      views.forEach(({ view, props }) => {
        this.collectViewComponent(view, containerId, props);
      });
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidRender) {
        contribution.onDidRender();
      }
    }
    const list: Array<Promise<void>> = [];
    // 这里保证的 viewReady 并不是真实的 viewReady，只是保证在此刻之前注册进来的 Tabbar Ready 了
    // 仅确保 tabbar 视图加载完毕
    this.tabbarServices.forEach((service) => {
      if (slotRendererRegistry.isTabbar(service.location) && service.containersMap.size > 0) {
        // 当初始容器组件数量为 0 时，不阻塞 LayoutService 初始化
        // 后续在新注册容器时会通过 onDidRegisterContainer 事件初始化对应面板的 TabbarService
        list.push(service.viewReady.promise);
      }
    });
    Promise.all(list).then(() => {
      this.viewReady.resolve();
    });
  }

  storeState(service: TabbarService, currentId?: string) {
    this.state[service.location] = {
      currentId,
      size: service.prevSize,
    };

    this.layoutState.setState(LAYOUT_STATE.MAIN, this.state);
  }

  @OnEvent(ThemeChangedEvent)
  onThemeChange(e: ThemeChangedEvent) {
    const theme = e.payload.theme;
    localStorage.setItem(
      'theme',
      JSON.stringify({
        menuBarBackground: theme.getColor('kt.menubar.background')?.toString(),
        sideBarBackground: theme.getColor('sideBar.background')?.toString(),
        editorBackground: theme.getColor('editor.background')?.toString(),
        panelBackground: theme.getColor('panel.background')?.toString(),
        statusBarBackground: theme.getColor('statusBar.background')?.toString(),
      }),
    );
  }

  restoreTabbarService = async (service: TabbarService) => {
    this.state = fixLayout(this.layoutState.getState(LAYOUT_STATE.MAIN, defaultLayoutState));
    const { currentId, size } = this.state[service.location] || {};
    service.prevSize = size;

    // 根据存储的容器位置信息恢复容器位置(drag & drop 移动过的)
    if (this.state.containerLocations) {
      for (const [containerId, targetLocation] of Object.entries(this.state.containerLocations)) {
        if (targetLocation === service.location && !this.isDropContainer(containerId)) {
          // 检查容器是否在其他 tabbar 中，如果是则移动到当前 tabbar
          const expectTabbar = this.findTabbarServiceByContainerId(containerId);
          if (expectTabbar && expectTabbar.location !== service.location) {
            this.moveContainerTo(containerId, service.location);
          } else {
            // 清理无用的状态
            delete this.state.containerLocations[containerId];
            this.layoutState.setState(LAYOUT_STATE.MAIN, this.state);
          }
        }
      }
    }

    const defaultContainer = this.getDefaultContainer(service);
    this.restoreContainerId(service, currentId, defaultContainer);
  };

  private getDefaultContainer(service: TabbarService): string | undefined {
    const defaultPanels = this.appConfig.defaultPanels;
    const defaultPanel = defaultPanels && defaultPanels[service.location];

    // 如果配置了默认面板,则使用配置的面板
    if (defaultPanels && defaultPanel !== undefined) {
      if (!defaultPanel) {
        return '';
      }
      if (service.containersMap.has(defaultPanel)) {
        return defaultPanel;
      }

      const componentInfo = this.componentRegistry.getComponentRegistryInfo(defaultPanel);
      const isValidModule =
        componentInfo && this.appConfig.layoutConfig[service.location]?.modules?.includes(defaultPanel);

      if (isValidModule) {
        return componentInfo.options!.containerId;
      }

      this.logger.warn(`[defaultPanels] No \`${defaultPanel}\` view found!`);
    }

    // 获取第一个可见容器作为默认值
    return service.visibleContainers[0]?.options?.containerId;
  }

  private restoreContainerId(
    service: TabbarService,
    currentId: string | undefined,
    defaultContainer: string | undefined,
  ) {
    if (isUndefined(currentId)) {
      // 未指定 currentId 时,使用默认容器或第一个注册的容器
      if (isUndefined(defaultContainer)) {
        service.updateNextContainerId();
      } else {
        service.updateCurrentContainerId(defaultContainer);
      }
      return;
    }

    if (currentId && !this.isDropContainer(currentId)) {
      if (service.containersMap.has(currentId)) {
        service.updateCurrentContainerId(currentId);
        return;
      }

      // 如果当前 containerId 不存在，则使用默认容器
      service.updateCurrentContainerId(defaultContainer || '');
      service.updateNextContainerId(currentId);
      return;
    }

    if (currentId === '' || this.isDropContainer(currentId)) {
      service.updateCurrentContainerId('');
    }
  }

  findTabbarServiceByContainerId(containerId: string): TabbarService | undefined {
    let tabbarService: undefined | TabbarService;
    for (const value of this.tabbarServices.values()) {
      if (value.containersMap.has(containerId)) {
        tabbarService = value;
        break;
      }
    }

    return tabbarService;
  }

  moveContainerTo(containerId: string, to: string): void {
    const fromTabbar = this.findTabbarServiceByContainerId(containerId);

    if (!fromTabbar) {
      this.logger.error(`cannot find container: ${containerId}`);
      return;
    }
    const container = fromTabbar.getContainer(containerId);
    if (!container) {
      this.logger.error(`cannot find container: ${containerId}`);
      return;
    }
    if (container.options?.draggable === false) {
      this.logger.warn(`container: ${containerId} is not draggable`);
      return;
    }

    const toTabbar = this.getTabbarService(to);

    fromTabbar.removeContainer(containerId);

    if (!fromTabbar.visibleContainers.length || fromTabbar.currentContainerId.get() === containerId) {
      this.toggleSlot(fromTabbar.location, false);
    }
    toTabbar.dynamicAddContainer(containerId, container);
    const newHandler = this.injector.get(TabBarHandler, [containerId, this.getTabbarService(toTabbar.location)]);
    this.handleMap.set(containerId, newHandler!);

    // 更新容器位置信息
    if (!this.state.containerLocations) {
      this.state.containerLocations = {};
    }
    this.state.containerLocations[containerId] = to;
    // this.layoutState.setState(LAYOUT_STATE.MAIN, this.state);
  }

  showDropAreaForContainer(containerId: string): void {
    const tabbarService = this.findTabbarServiceByContainerId(containerId);
    const panelService = this.tabbarServices.get(SlotLocation.panel);
    const extendViewService = this.tabbarServices.get(SlotLocation.extendView);
    const viewService = this.tabbarServices.get(SlotLocation.view);
    if (!tabbarService) {
      this.logger.error(`cannot find container: ${containerId}`);
      return;
    }
    const otherServices = {
      [SlotLocation.extendView]: [panelService, viewService],
      [SlotLocation.panel]: [extendViewService, viewService],
      [SlotLocation.view]: [panelService, extendViewService],
    };

    const dropContainers = {
      [SlotLocation.panel]: DROP_PANEL_CONTAINER,
      [SlotLocation.extendView]: DROP_EXTEND_VIEW_CONTAINER,
      [SlotLocation.view]: DROP_VIEW_CONTAINER,
    };

    transaction((tx) => {
      otherServices[tabbarService?.location]?.forEach((service) => {
        service?.updateCurrentContainerId(dropContainers[service?.location], tx);
      });
    });
  }

  hideDropArea(): void {
    const panelService = this.tabbarServices.get(SlotLocation.panel);
    const extendViewService = this.tabbarServices.get(SlotLocation.extendView);
    const viewService = this.tabbarServices.get(SlotLocation.view);

    transaction((tx) => {
      if (panelService?.currentContainerId.get() === DROP_PANEL_CONTAINER) {
        panelService.updateCurrentContainerId(panelService.previousContainerId || '', tx);
      }
      if (extendViewService?.currentContainerId.get() === DROP_EXTEND_VIEW_CONTAINER) {
        extendViewService.updateCurrentContainerId(extendViewService.previousContainerId || '', tx);
      }
      if (viewService?.currentContainerId.get() === DROP_VIEW_CONTAINER) {
        viewService.updateCurrentContainerId(viewService.previousContainerId || '', tx);
      }
    });
  }

  isVisible(location: string) {
    const tabbarService = this.getTabbarService(location);
    return !!tabbarService.currentContainerId.get();
  }

  isViewVisible(viewId: string): boolean {
    const tabbarHandler = this.getTabbarHandler(viewId);
    if (!tabbarHandler || !tabbarHandler.isActivated()) {
      return false;
    }
    const viewState = tabbarHandler.accordionService.getViewState(viewId);
    return !viewState.collapsed && !viewState.hidden;
  }

  toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void {
    const tabbarService = this.getTabbarService(location);
    if (!tabbarService) {
      this.debug.error(`Unable to switch panels because no TabbarService corresponding to \`${location}\` was found.`);
      return;
    }
    if (show === true) {
      // 不允许通过该api展示drop面板
      tabbarService.updateCurrentContainerId(this.findNonDropContainerId(tabbarService));
    } else if (show === false) {
      tabbarService.updateCurrentContainerId('');
    } else {
      tabbarService.updateCurrentContainerId(
        tabbarService.currentContainerId.get() ? '' : this.findNonDropContainerId(tabbarService),
      );
    }
    if (tabbarService.currentContainerId.get() && size) {
      tabbarService.resizeHandle?.setSize(size);
    }
  }

  private isDropContainer(containerId: string): boolean {
    return [DROP_PANEL_CONTAINER, DROP_EXTEND_VIEW_CONTAINER, DROP_VIEW_CONTAINER].includes(containerId);
  }

  private findNonDropContainerId(tabbarService: TabbarService): string {
    const currentContainerId = tabbarService.currentContainerId.get();
    if (currentContainerId && !this.isDropContainer(currentContainerId)) {
      return currentContainerId;
    }
    if (tabbarService.previousContainerId && !this.isDropContainer(tabbarService.previousContainerId)) {
      return tabbarService.previousContainerId;
    }

    for (const key of tabbarService.containersMap.keys()) {
      if (!this.isDropContainer(key)) {
        return key;
      }
    }

    return '';
  }

  getTabbarService(location: string) {
    const service = this.tabbarServices.get(location) || this.injector.get(TabbarService, [location]);
    if (!this.tabbarServices.get(location)) {
      service.addDispose(
        service.onCurrentChange(({ currentId }) => {
          this.storeState(service, currentId);
          // onView 也支持监听 containerId
          this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onView', data: currentId }));
          if (currentId && SUPPORT_ACCORDION_LOCATION.has(service.location)) {
            const accordionService = this.getAccordionService(currentId);
            accordionService?.tryUpdateResize();
            accordionService?.expandedViews.forEach((view) => {
              this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onView', data: view.id }));
            });
          }
        }),
      );
      service.viewReady.promise
        .then(() => service.restoreState())
        .then(() => this.restoreTabbarService(service))
        .catch((err) => {
          this.logger.error(`[TabbarService:${location}] restore state error`, err);
        });
      const debouncedStoreState = debounce(() => this.storeState(service, service.currentContainerId.get()), 100);
      service.addDispose(service.onSizeChange(debouncedStoreState));
      if (location === SlotLocation.panel) {
        // use this getter's side effect to set bottomExpanded contextKey
        const debouncedUpdate = debounce(() => void this.bottomExpanded, 100);
        service.addDispose(service.onSizeChange(() => debouncedUpdate));
      }
      this.tabbarServices.set(location, service);
    }
    return service;
  }

  getAllAccordionService() {
    return this.accordionServices;
  }

  getAccordionService(containerId: string, noRestore?: boolean) {
    let service = this.accordionServices.get(containerId);
    if (!service) {
      service = this.injector.get(AccordionService, [containerId, noRestore]);
      this.accordionServices.set(containerId, service!);
    }
    return service!;
  }

  getTabbarHandler(viewOrContainerId: string): TabBarHandler | undefined {
    let handler = this.doGetTabbarHandler(viewOrContainerId);
    if (!handler) {
      const containerId = this.viewToContainerMap.get(viewOrContainerId);
      if (!containerId) {
        this.debug.warn(`${viewOrContainerId} view tabbar not found.`);
      } else {
        handler = this.doGetTabbarHandler(containerId || '');
      }
    }
    return handler;
  }

  getContainer(containerId: string): ComponentRegistryInfo | undefined {
    for (const service of this.tabbarServices.values()) {
      const container = service.getContainer(containerId);
      if (container) {
        return container;
      }
    }
  }

  getExtraTopMenu(): IContextMenu {
    return this.contextmenuService.createMenu({
      id: MenuId.ActivityBarTopExtra,
    });
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
      for (const service of this.tabbarServices.values()) {
        if (service.getContainer(containerId)) {
          location = service.location;
          break;
        }
      }
      if (location) {
        activityHandler = this.injector.get(TabBarHandler, [containerId, this.getTabbarService(location)]);
        this.handleMap.set(containerId, activityHandler!);
      }
    }
    return activityHandler;
  }

  private holdTabbarComponent = new Map<string, { views: View[]; options: ViewContainerOptions; side: string }>();

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: any): string {
    if (Fc) {
      this.debug.warn('collectTabbarComponent api warning: Please move react component into options.component!');
    }
    side = this.mapSideToLocation(side);
    if (options.hideIfEmpty && !views.length && !options.component) {
      this.holdTabbarComponent.set(options.containerId, { views, options, side });
      if (this.tabbarUpdateSet.has(options.containerId)) {
        this.tryUpdateTabbar(options.containerId);
      }
      const service = this.getAccordionService(options.containerId);
      // 如果 append view 时尝试注册 holdTabbarComponent
      service.addDispose(
        service.onBeforeAppendViewEvent(() => {
          this.tryUpdateTabbar(options.containerId);
        }),
      );
      service.addDispose(
        service.onAfterDisposeViewEvent(() => {
          // 如果没有其他 view ，则 remove 掉 container
          if (service.views.length === 0) {
            this.disposeContainer(options.containerId);
            // 重新注册到 holdTabbarComponent ,以便再次 append 时能注册传上去
            this.holdTabbarComponent.set(options.containerId, { views, options, side });
          }
        }),
      );
      return options.containerId;
    }
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, { views, options });
    views.forEach((view) => {
      this.viewToContainerMap.set(view.id, options.containerId);
    });
    return options.containerId;
  }

  private mapSideToLocation(side: string): SlotLocation {
    switch (side) {
      case 'left':
        return SlotLocation.view;
      case 'right':
        return SlotLocation.extendView;
      case 'bottom':
        return SlotLocation.panel;
      default:
        return side;
    }
  }

  getViewAccordionService(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      return;
    }

    return this.getAccordionService(containerId);
  }

  collectViewComponent(view: View, containerId: string, props: any = {}, options?: ViewComponentOptions): string {
    this.customViews.set(view.id, view);
    this.viewToContainerMap.set(view.id, containerId);
    const accordionService: AccordionService = this.getAccordionService(containerId);
    if (props) {
      view.initialProps = props;
    }
    accordionService.appendView(view, options?.isReplace);

    // 如果之前没有views信息，且为hideIfEmpty类型视图则需要刷新
    if (accordionService.views.length === 1) {
      this.tabbarUpdateSet.add(containerId);
      this.tryUpdateTabbar(containerId);
    }

    if (options?.fromExtension) {
      this.disposableMap.set(
        view.id,
        this.commandRegistry.registerCommand(
          {
            id: `${view.id}.focus`,
          },
          {
            execute: async () => {
              await this.ensureViewReady(view.id);
              // TODO: 目前 view 没有 focus 状态，先跳转到对应的 container 上
              return this.commandService.executeCommand(`workbench.view.extension.${containerId}`, { forceShow: true });
            },
          },
        ),
      );
    }

    return containerId;
  }

  private ensureViewReady(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId)!;
    const viewReady = new Deferred<void>();
    const accordionService = this.getAccordionService(containerId);
    if (!accordionService.visibleViews.get().find((view) => view.id === viewId)) {
      accordionService.addDispose(
        accordionService.onAfterAppendViewEvent((id) => {
          if (id === viewId) {
            viewReady.resolve();
          }
        }),
      );
    } else {
      viewReady.resolve();
    }
    return viewReady.promise;
  }

  // 时序保证用，view先注册，container后注册同样需要触发更新
  private tabbarUpdateSet: Set<string> = new Set();

  // 由于注册container和view的时序不能保障，注册时需要互相触发
  private tryUpdateTabbar(containerId: string) {
    const holdInfo = this.holdTabbarComponent.get(containerId);
    if (holdInfo) {
      const tabbarService = this.getTabbarService(holdInfo.side);
      tabbarService.registerContainer(containerId, { views: holdInfo.views, options: holdInfo.options });
      this.tabbarUpdateSet.delete(containerId);
      this.holdTabbarComponent.delete(containerId);
    }
  }

  replaceViewComponent(view: View, props?: any) {
    const containerId = this.viewToContainerMap.get(view.id);
    if (!containerId) {
      this.debug.warn(
        `The container corresponding to \`${view.id}\` was not found, please check the incoming parameters!`,
      );
      return;
    }
    const contributedView = this.customViews.get(view.id);
    if (contributedView) {
      view = Object.assign(contributedView, view);
    }

    this.collectViewComponent(view, containerId!, props, {
      isReplace: true,
    });
  }

  disposeViewComponent(viewId: string) {
    const toDispose = this.disposableMap.get(viewId);

    if (toDispose) {
      toDispose.dispose();
    }

    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      this.debug.warn(
        `The container corresponding to \`${viewId}\` was not found, please check the incoming parameters!`,
      );
      return;
    }

    const accordionService: AccordionService = this.getAccordionService(containerId);

    accordionService.disposeView(viewId);
  }

  revealView(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      this.debug.warn(
        `The container corresponding to \`${viewId}\` was not found, please check the incoming parameters!`,
      );
      return;
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    accordionService.revealView(viewId);
  }

  disposeContainer(containerId: string) {
    let location: string | undefined;
    for (const service of this.tabbarServices.values()) {
      if (service.getContainer(containerId)) {
        location = service.location;
        break;
      }
    }
    if (location) {
      const tabbarService = this.getTabbarService(location);
      tabbarService.disposeContainer(containerId);
    } else {
      this.debug.warn(`The Tabbar to the \`${containerId}\` was not found.`);
    }
  }

  // TODO 这样很耦合，不能做到tab renderer自由拆分
  expandBottom(expand: boolean): void {
    const tabbarService = this.getTabbarService(SlotLocation.panel);
    if (!tabbarService.currentContainerId.get()) {
      tabbarService.updateCurrentContainerId(
        tabbarService.currentContainerId.get() ||
          tabbarService.previousContainerId ||
          tabbarService.containersMap.keys().next().value!,
      );
    }
    tabbarService.doExpand(expand);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
  }

  get bottomExpanded(): boolean {
    const tabbarService = this.getTabbarService(SlotLocation.panel);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
    return tabbarService.isExpanded;
  }
}
