import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  WithEventBus,
  IDisposable,
  View,
  ViewContainerOptions,
  ContributionProvider,
  SlotLocation,
  IContextKeyService,
  ExtensionActivateEvent,
  AppConfig,
  ComponentRegistry,
  ILogger,
  CommandRegistry,
  CommandService,
  OnEvent,
  slotRendererRegistry,
} from '@opensumi/ide-core-browser';
import {
  MainLayoutContribution,
  IMainLayoutService,
  ViewComponentOptions,
  SUPPORT_ACCORDION_LOCATION,
} from '../common';
import { TabBarHandler } from './tabbar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import {
  IMenuRegistry,
  AbstractContextMenuService,
  MenuId,
  AbstractMenuService,
  IContextMenu,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { LayoutState, LAYOUT_STATE } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { AccordionService } from './accordion/accordion.service';
import debounce = require('lodash.debounce');
import { Deferred } from '@opensumi/ide-core-common';
import { ThemeChangedEvent } from '@opensumi/ide-theme';

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
      views.forEach(({ view, props }) => {
        this.collectViewComponent(view, containerId, props);
      });
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidRender) {
        contribution.onDidRender();
      }
    }
    this.restoreState();
    const list: Array<Promise<void>> = [];
    // 渲染之后注册的tab不再恢复状态
    this.tabbarServices.forEach((service) => {
      service.restoreState();
      // 仅确保tabbar视图加载完毕
      if (slotRendererRegistry.isTabbar(service.location)) {
        list.push(service.viewReady.promise);
      }
    });
    Promise.all(list).then(() => {
      this.viewReady.resolve();
    });
  }

  setFloatSize(size: number) {}

  storeState(service: TabbarService, currentId: string) {
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
    for (const service of this.tabbarServices.values()) {
      const { currentId, size } = this.state[service.location] || {};
      service.prevSize = size;
      let defaultContainer = service.visibleContainers[0] && service.visibleContainers[0].options!.containerId;
      const defaultPanels = this.appConfig.defaultPanels;
      const restorePanel = defaultPanels && defaultPanels[service.location];
      if (defaultPanels && restorePanel !== undefined) {
        if (restorePanel) {
          if (service.containersMap.has(restorePanel)) {
            defaultContainer = restorePanel;
          } else {
            const componentInfo = this.componentRegistry.getComponentRegistryInfo(restorePanel);
            if (
              componentInfo &&
              this.appConfig.layoutConfig[service.location]?.modules &&
              ~this.appConfig.layoutConfig[service.location].modules.indexOf(restorePanel)
            ) {
              defaultContainer = componentInfo.options!.containerId;
            } else {
              this.logger.warn(`[defaultPanels] 没有找到${restorePanel}对应的视图!`);
            }
          }
        } else {
          defaultContainer = '';
        }
      }
      if (currentId === undefined) {
        service.currentContainerId = defaultContainer;
      } else {
        service.currentContainerId = currentId
          ? service.containersMap.has(currentId)
            ? currentId
            : defaultContainer
          : '';
      }
    }
  }

  isVisible(location: string) {
    const tabbarService = this.getTabbarService(location);
    return !!tabbarService.currentContainerId;
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
      // tslint:disable-next-line no-console
      console.error(`没有找到${location}对应位置的TabbarService，无法切换面板`);
      return;
    }
    if (show === true) {
      tabbarService.currentContainerId =
        tabbarService.currentContainerId ||
        tabbarService.previousContainerId ||
        tabbarService.containersMap.keys().next().value;
    } else if (show === false) {
      tabbarService.currentContainerId = '';
    } else {
      tabbarService.currentContainerId = tabbarService.currentContainerId
        ? ''
        : tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    }
    if (tabbarService.currentContainerId && size) {
      tabbarService.resizeHandle?.setSize(size);
    }
  }

  getTabbarService(location: string) {
    const service = this.tabbarServices.get(location) || this.injector.get(TabbarService, [location]);
    if (!this.tabbarServices.get(location)) {
      service.onCurrentChange(({ currentId }) => {
        this.storeState(service, currentId);
        // onView 也支持监听 containerId
        this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onView', data: currentId }));
        if (currentId && SUPPORT_ACCORDION_LOCATION.has(service.location)) {
          const accordionService = this.getAccordionService(currentId);
          accordionService.tryUpdateResize();
          accordionService.expandedViews.forEach((view) => {
            this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onView', data: view.id }));
          });
        }
      });
      service.onSizeChange(() => debounce(() => this.storeState(service, service.currentContainerId), 200)());
      this.tabbarServices.set(location, service);
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
        console.warn(`${viewOrContainerId} view tabbar not found.`);
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
      for (const service of this.tabbarServices.values()) {
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

  private holdTabbarComponent = new Map<string, { views: View[]; options: ViewContainerOptions; side: string }>();

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: any): string {
    if (Fc) {
      // tslint:disable-next-line no-console
      console.warn('collectTabbarComponent api warning: Please move react component into options.component!');
    }
    if (options.hideIfEmpty && !views.length && !options.component) {
      this.holdTabbarComponent.set(options.containerId, { views, options, side });
      if (this.tabbarUpdateSet.has(options.containerId)) {
        this.tryUpdateTabbar(options.containerId);
      }
      const service = this.getAccordionService(options.containerId);
      // 如果 append view 时尝试注册 holdTabbarComponent
      service.onBeforeAppendViewEvent(() => {
        this.tryUpdateTabbar(options.containerId);
      });
      service.onAfterDisposeViewEvent(() => {
        // 如果没有其他 view ，则 remove 掉 container
        if (service.views.length === 0) {
          this.disposeContainer(options.containerId);
          // 重新注册到 holdTabbarComponent ,以便再次 append 时能注册传上去
          this.holdTabbarComponent.set(options.containerId, { views, options, side });
        }
      });
      return options.containerId;
    }
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, { views, options });
    views.forEach((view) => {
      this.viewToContainerMap.set(view.id, options.containerId);
    });
    return options.containerId;
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
    if (!accordionService.visibleViews.find((view) => view.id === viewId)) {
      accordionService.onAfterAppendViewEvent((id) => {
        if (id === viewId) {
          viewReady.resolve();
        }
      });
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
      // tslint:disable-next-line no-console
      console.warn(`没有找到${view.id}对应的容器，请检查传入参数!`);
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
      // tslint:disable-next-line no-console
      console.warn(`没有找到${viewId}对应的容器，请检查传入参数!`);
      return;
    }

    const accordionService: AccordionService = this.getAccordionService(containerId);

    accordionService.disposeView(viewId);
  }

  revealView(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${viewId}对应的容器，请检查传入参数!`);
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
}
