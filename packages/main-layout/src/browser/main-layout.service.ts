import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject, Domain } from '@ali/common-di';
import {
  SplitPanel,
  SplitLayout,
  Widget,
  BoxLayout,
  BoxPanel,
} from '@phosphor/widgets';
import { AppConfig, SlotLocation } from '@ali/ide-core-browser';
import { Disposable } from '@ali/ide-core-browser';
import { ActivityBarService, Side } from '@ali/ide-activity-bar/lib/browser/activity-bar.service';
import { IEventBus, ContributionProvider, StorageProvider, STORAGE_NAMESPACE, IStorage, WithEventBus, OnEvent, MaybeNull } from '@ali/ide-core-common';
import { InitedEvent, IMainLayoutService, MainLayoutContribution, ComponentCollection, ViewToContainerMapData } from '../common';
import { ComponentRegistry, ResizeEvent, SideStateManager, VisibleChangedEvent, VisibleChangedPayload, RenderedEvent } from '@ali/ide-core-browser/lib/layout';
import { ReactWidget } from './react-widget.view';
import { IWorkspaceService } from '@ali/ide-workspace';
import { ViewContainerOptions, View } from '@ali/ide-core-browser/lib/layout';
import { IdeWidget } from '@ali/ide-core-browser/lib/layout/ide-widget.view';
import { SplitPositionHandler } from '@ali/ide-core-browser/lib/layout/split-panels';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import { CustomSplitLayout } from './split-layout';
import { TrackerSplitPanel } from './split-panel';
import { IIconService } from '@ali/ide-theme';

export interface TabbarWidget {
  widget: Widget;
  panel: Widget;
  size?: number;
  resizeTimer?: any;
  // 左右侧面板状态
  expanded?: boolean;
  barSize: number;
}

const getSideBarSize = (layoutSize?: number) => {
  if (layoutSize !== undefined) {
    return layoutSize;
  }
  return 48;
};

export interface TabbarCollection extends ComponentCollection {
  side: string;
}

@Injectable()
export class MainLayoutService extends WithEventBus implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired()
  private activityBarService: ActivityBarService;

  @Autowired()
  splitHandler: SplitPositionHandler;

  @Autowired(IWorkspaceService)
  protected workspaceService: IWorkspaceService;

  @Autowired(ComponentRegistry)
  componentRegistry: ComponentRegistry;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IIconService)
  private iconService: IIconService;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  @Autowired()
  layoutState: LayoutState;

  private configContext: AppConfig;

  private topBarWidget: IdeWidget;
  private mainSlotWidget: IdeWidget;
  private bottomSlotWidget: BoxPanel;
  private statusBarWidget: IdeWidget;

  private leftPanelWidget: Widget;
  private rightPanelWidget: Widget;

  private horizontalPanel: SplitPanel;
  private middleWidget: SplitPanel;

  private layoutPanel: BoxPanel;
  private topBoxPanel: BoxPanel;

  private readonly tabbarMap: Map<SlotLocation, TabbarWidget> = new Map();

  public readonly tabbarComponents: TabbarCollection[] = [];

  private sideState: SideStateManager;

  private restoring = true;

  private tabRendered = false;
  private viewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  // 从上到下包含顶部bar、中间横向大布局和底部bar
  createLayout(node: HTMLElement) {
    this.topBarWidget = this.initIdeWidget(SlotLocation.top);
    this.horizontalPanel = this.createSplitHorizontalPanel();
    this.statusBarWidget = this.initIdeWidget(SlotLocation.bottomBar);

    // 设置id，配置样式
    this.topBarWidget.addClass('top-slot');
    this.horizontalPanel.id = 'main-box';
    this.statusBarWidget.id = 'status-bar';

    const layout = this.createBoxLayout(
      [this.topBarWidget, this.horizontalPanel, this.statusBarWidget],
      [0, 1, 0],
      { direction: 'top-to-bottom', spacing: 0 },
    );
    this.layoutPanel = new BoxPanel({ layout });
    this.layoutPanel.id = 'main-layout';
    Widget.attach(this.layoutPanel, node);
    window.requestAnimationFrame(() => {
      this.eventBus.fire(new RenderedEvent());
    });
  }

  // TODO 后续可以把配置和contribution整合起来
  useConfig(configContext: AppConfig, node: HTMLElement) {
    this.configContext = configContext;
    this.createLayout(node);
    const { layoutConfig } = configContext;
    for (const location of Object.keys(layoutConfig)) {
      if (location === SlotLocation.top) {
        const tokens = layoutConfig[location].modules;
        const targetSize = 'min-height';
        let slotHeight = 0;
        const widgets: Widget[] = [];
        // tslint:disable-next-line
        for (const i in tokens) {
          const { views, options } = this.getComponentInfoFrom(tokens[i]);
          const size = options && options.size || 0;
          const components = views ? views.map((view) => {
            return view.component!;
          }) : [];
          widgets.push(new ReactWidget(configContext, components));
          widgets[i].node.style[targetSize] = `${size}px`;
          slotHeight += size;
        }
        const topSlotLayout = this.createBoxLayout(
          widgets, widgets.map(() => 0) as Array<number>, { direction: 'top-to-bottom', spacing: 0 },
        );
        this.topBoxPanel = new BoxPanel({ layout: topSlotLayout });
        this.topBarWidget.node.style.minHeight = this.topBoxPanel.node.style.height = `${slotHeight}px`;
        this.topBarWidget.setWidget(this.topBoxPanel);
      } else if (location === SlotLocation.main) {
        if (layoutConfig[location].modules[0]) {
          const { views } = this.getComponentInfoFrom(layoutConfig[location].modules[0]);
          const component = views && views.map((view) => view.component);
          this.mainSlotWidget.setComponent(component);
        }
      } else if (location === SlotLocation.left || location === SlotLocation.right || location === SlotLocation.bottom) {
        layoutConfig[location].modules.forEach((token) => {
          const { views, options } = this.getComponentInfoFrom(token);
          if (!options || !options.containerId) {
            console.warn('请在options内传入containerId!', token);
          }
          this.collectTabbarComponent(views || [], options || {containerId: token}, location);
        });
      } else if (location === SlotLocation.statusBar) {
        const { views, options } = this.getComponentInfoFrom(layoutConfig[location].modules[0]);
        const component = views && views.map((view) => view.component);
        const size = options && options.size || 19;
        // TODO statusBar支持堆叠
        this.statusBarWidget.node.style.minHeight = `${size}px`;
        this.statusBarWidget.setComponent(component);
      }
    }
    // 声明式注册的Tabbar组件注册完毕，渲染数据
    for (const tabbarItem of this.tabbarComponents) {
      this.registerTabbarComponent(tabbarItem.views || [], tabbarItem.options, tabbarItem.side || '');
    }
    for (const [containerId, viewWithProps] of this.viewsMap.entries()) {
      viewWithProps.forEach(({view, props}) => {
        this.registerViewComponent(view, containerId, props);
      });
    }
    this.tabRendered = true;
    this.refreshTabbar();
    if (!this.workspaceService.workspace) {
      this.toggleSlot(SlotLocation.left, false);
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidUseConfig) {
        contribution.onDidUseConfig();
      }
    }
  }

  private async refreshTabbar() {
    if (!this.sideState.left!.tabbars.length) {
      // 无数据初始化
      this.tabbarComponents.forEach((element: TabbarCollection) => {
        this.sideState[element.side]!.tabbars.push({
          containerId: element.options.containerId,
          hidden: !!element.options.hidden,
        });
      });
    }
    if (this.sideState.bottom!.collapsed) {
      await this.togglePanel('bottom', false);
    } else {
      const initSize = this.sideState.bottom!.size;
      this.togglePanel('bottom', true, initSize);
    }
    this.activityBarService.refresh(this.sideState);
    // FIXME setPanelSize是一个异步的工作，但是是通过command触发的，command导致的类似循环依赖导致有点难维护
    setTimeout(() => {
      this.restoring = false;
    }, 2000);
  }

  // TODO expand状态支持
  public async restoreState() {
    const defaultState = {
      left: {
        size: 400,
        currentIndex: 0,
        tabbars: [],
      },
      right: {
        size: 400,
        currentIndex: -1,
        tabbars: [],
      },
      bottom: {
        size: 200,
        currentIndex: 0,
        tabbars: [],
      },
    };
    this.sideState = this.layoutState.getState(LAYOUT_STATE.MAIN, defaultState);
    // this.sideState = defaultState;
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    const side = e.payload.slotLocation as Side;
    if (side === SlotLocation.left || side === SlotLocation.right || side === SlotLocation.bottom) {
      const tabbarInfo = this.tabbarMap.get(side) as TabbarWidget;
      clearTimeout(tabbarInfo.resizeTimer);
      tabbarInfo.resizeTimer = setTimeout(() => {
        if (side !== 'bottom') {
          // bar的宽度
          this.storeState(side, e.payload.width + tabbarInfo.barSize);
        } else {
          this.storeState(side, e.payload.height + 28);
        }
      }, 60);
    }
  }

  private storeState(side: Side, size: number) {
    const tabbarWidget = this.tabbarMap.get(side)!;
    const { barSize, expanded } = tabbarWidget;
    if (size === barSize || this.restoring) { return; }
    if (expanded) {
      this.sideState[side]!.expanded = true;
    } else {
      this.sideState[side]!.size = size;
    }
    this.layoutState.setState(LAYOUT_STATE.MAIN, this.sideState);
  }

  registerTabbarViewToContainerMap(map: ViewToContainerMapData) {
    this.activityBarService.registerViewToContainerMap(map);
  }

  private getComponentInfoFrom(token: string): ComponentCollection {
    const collection = this.componentRegistry.getComponentRegistryInfo(token)!;
    if (!collection.options) {
      collection.options = {
        containerId: token,
      };
    }
    if (!collection) {
      console.error(`模块${token}信息初始化失败`);
    }
    return collection as ComponentCollection;
  }

  getTabbarHandler(handlerId: string) {
    return this.activityBarService.getTabbarHandler(handlerId);
  }

  async toggleSlot(location: string, show?: boolean, size?: number) {
    const side = location as Side;
    const tabbar = this.getTabbar(side);
    if (typeof show === 'boolean') {
      await this.togglePanel(side, show, size);
    } else {
      tabbar.widget.isHidden ? await this.togglePanel(side, true, size) : await this.togglePanel(side, false, size);
    }
  }

  public get bottomExpanded() {
    return this.middleWidget.relativeSizes().join(',') === '0,1';
  }

  private prevRelativeSize: number[];
  async expandBottom(expand?: boolean) {
    if (expand) {
      this.prevRelativeSize = this.middleWidget.relativeSizes();
      this.middleWidget.setRelativeSizes([0, 1]);
    } else {
      this.middleWidget.setRelativeSizes(this.prevRelativeSize);
    }
  }

  isVisible(location: SlotLocation) {
    const tabbar = this.getTabbar(location as Side);
    return tabbar.panel.isVisible;
  }

  protected registerTabbarComponent(views: View[], options: ViewContainerOptions, side: string) {
    return this.activityBarService.append(views, options, side as Side);
  }

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string): string {
    if (!this.tabRendered) {
      this.tabbarComponents.push({
        views,
        options,
        side,
      });
      return options.containerId!;
    } else {
      return this.registerTabbarComponent(views, options, side);
    }
  }

  protected registerViewComponent(view: View, containerId: string, props?: any) {
    const viewContainer = this.activityBarService.getContainer(containerId);
    if (viewContainer) {
      viewContainer.addWidget(view, props);
    } else {
      console.warn(`找不到${containerId}对应的容器，无法注册视图！`);
    }
  }

  collectViewComponent(view: View, containerId: string, props?: any) {
    if (!this.tabRendered) {
      const items = this.viewsMap.get(containerId);
      items ? items.push({view, props}) : this.viewsMap.set(containerId, [{view, props}]);
    } else {
      this.registerViewComponent(view, containerId, props);
    }
    return containerId;
  }

  private initIdeWidget(location?: string, component?: React.FunctionComponent) {
    return this.injector.get(IdeWidget, [this.configContext, component, location]);
  }

  private createSplitHorizontalPanel() {
    const leftSlotWidget = this.createActivityWidget(SlotLocation.left);
    const rightSlotWidget = this.createActivityWidget(SlotLocation.right);
    this.bottomSlotWidget = this.createActivityWidget(SlotLocation.bottom);
    this.middleWidget = this.createMiddleWidget(this.bottomSlotWidget);
    const layoutConfig = this.configContext.layoutConfig;
    this.tabbarMap.set(SlotLocation.left, { widget: leftSlotWidget, panel: this.leftPanelWidget, barSize: getSideBarSize(layoutConfig[SlotLocation.leftBar].size) });
    this.tabbarMap.set(SlotLocation.right, { widget: rightSlotWidget, panel: this.rightPanelWidget, barSize: getSideBarSize(layoutConfig[SlotLocation.rightBar].size) });
    this.tabbarMap.set(SlotLocation.bottom, { widget: this.bottomSlotWidget, panel: this.bottomSlotWidget, barSize: 0 });
    const horizontalSplitLayout = this.createSplitLayout([leftSlotWidget, this.middleWidget, rightSlotWidget], [0, 1, 0], { orientation: 'horizontal', spacing: 0 });
    const panel = new TrackerSplitPanel({ layout: horizontalSplitLayout });
    panel.addClass('overflow-visible');
    return panel;
  }

  private async togglePanel(side: Side, show: boolean, targetSize?: number) {
    const tabbar = this.getTabbar(side);
    const { widget, panel, barSize } = tabbar;
    if (show) {
      this.setResizeLock(widget, side, false);
      panel.show();
      // 全屏
      if (targetSize && targetSize >= 9999) {
        const prev = this.horizontalPanel.relativeSizes();
        this.horizontalPanel.setRelativeSizes([prev[0] + prev[1], 0, prev[2]]);
        tabbar.expanded = true;
      } else {
        // 右侧状态可能是0
        const initSize = this.sideState[side]!.size || undefined;
        let lastPanelSize = initSize || this.configContext.layoutConfig[side].size || 400;
        if (targetSize) {
          lastPanelSize = targetSize;
        }
        await this.splitHandler.setSidePanelSize(widget, lastPanelSize, { side, duration: 0 });
        tabbar.expanded = false;
      }
    } else {
      panel.hide();
      await this.splitHandler.setSidePanelSize(widget, barSize, { side, duration: 0 });
      if (!tabbar.expanded) {
        const domSize = this.getPanelSize(side);
        tabbar.size = domSize;
        if (domSize !== barSize) {
          this.storeState(side, domSize);
        }
      } else {
        tabbar.expanded = false;
      }
      this.setResizeLock(widget, side, true);
    }
    if (side === 'bottom') {
      this.toggleBottomState(show);
    }
    if (show) {
      this.eventBus.fire(new VisibleChangedEvent(new VisibleChangedPayload(true, side)));
    } else {
      this.eventBus.fire(new VisibleChangedEvent(new VisibleChangedPayload(false, side)));
    }
  }

  // Lock resize
  private setResizeLock(widget, side, lock) {
    const splitPanel = widget.parent as SplitPanel;
    let index = splitPanel.widgets.indexOf(widget);
    if (index > 0 && (side === 'right' || side === 'bottom')) {
      index--;
    }
    if (lock) {
      splitPanel.handles[index].classList.add('p-lock');
    } else {
      splitPanel.handles[index].classList.remove('p-lock');
    }
  }

  private toggleBottomState(show: boolean) {
    this.sideState.bottom!.collapsed = !show;
    this.layoutState.setState(LAYOUT_STATE.MAIN, this.sideState);
  }

  private getPanelSize(side: Side) {
    const tabbar = this.getTabbar(side);
    return side !== 'bottom' ? tabbar.widget.node.clientWidth : tabbar.widget.node.clientHeight;
  }

  private getTabbar(side: Side): TabbarWidget {
    const tabbar = this.tabbarMap.get(side) as TabbarWidget;
    if (!tabbar) {
      console.warn('没有找到这个位置的Tabbar!');
    }
    return tabbar;
  }

  private createActivityWidget(side: string) {
    const {views: barViews} = this.getComponentInfoFrom(this.configContext.layoutConfig[SlotLocation[`${side}Bar`]].modules[0]);
    const panelViews = this.getComponentInfoFrom(this.configContext.layoutConfig[SlotLocation[`${side}Panel`]].modules[0]).views;
    const barComponent = barViews && barViews[0].component;
    const panelComponent = panelViews && panelViews[0].component;
    const activityBarWidget = this.initIdeWidget(`${side}Bar`, barComponent);
    activityBarWidget.id = side === 'bottom' ? 'bottom-bar' : 'activity-bar';
    const size = this.configContext.layoutConfig[SlotLocation[`${side}Bar`]].size;
    if (side !== 'bottom') {
      activityBarWidget.node.style.minWidth = getSideBarSize(size) + 'px';
      activityBarWidget.node.style.maxWidth = getSideBarSize(size) + 'px';
    }
    const activityPanelWidget = this.initIdeWidget(side, panelComponent);
    let direction: BoxLayout.Direction = 'left-to-right';
    if (side === SlotLocation.left) {
      activityPanelWidget.addClass('lock-width');
      this.leftPanelWidget = activityPanelWidget;
    } else if (side === SlotLocation.right) {
      this.rightPanelWidget = activityPanelWidget;
      direction = 'right-to-left';
    } else {
      activityPanelWidget.addClass('lock-height');
      activityPanelWidget.addClass('overflow-visible');
      direction = 'top-to-bottom';
    }
    const containerLayout = new BoxLayout({ direction, spacing: 0 });
    BoxPanel.setStretch(activityBarWidget, 0);
    containerLayout.addWidget(activityBarWidget);
    BoxPanel.setStretch(activityPanelWidget, 1);
    containerLayout.addWidget(activityPanelWidget);

    const activitorWidget = new BoxPanel({ layout: containerLayout });
    activitorWidget.addClass(`${side}-slot`);
    return activitorWidget;
  }

  /**
   * Create a box layout to assemble the application shell layout.
   */
  protected createBoxLayout(widgets: Widget[], stretch?: number[], options?: BoxPanel.IOptions): BoxLayout {
    const boxLayout = new BoxLayout(options);
    for (let i = 0; i < widgets.length; i++) {
      if (stretch !== undefined && i < stretch.length) {
        BoxPanel.setStretch(widgets[i], stretch[i]);
      }
      boxLayout.addWidget(widgets[i]);
    }
    return boxLayout;
  }

  /**
   * Create a split layout to assemble the application shell layout.
   */
  protected createSplitLayout(widgets: Widget[], stretch?: number[], options?: Partial<SplitLayout.IOptions>): CustomSplitLayout {
    let optParam: SplitLayout.IOptions = { renderer: SplitPanel.defaultRenderer };
    if (options) {
      optParam = { ...optParam, ...options };
    }
    const splitLayout = new CustomSplitLayout(optParam);
    for (let i = 0; i < widgets.length; i++) {
      if (stretch !== undefined && i < stretch.length) {
        SplitPanel.setStretch(widgets[i], stretch[i]);
      }
      splitLayout.addWidget(widgets[i]);
    }
    return splitLayout;
  }

  private createMiddleWidget(bottomSlotWidget: Widget) {
    this.mainSlotWidget = this.initIdeWidget(SlotLocation.main);
    this.mainSlotWidget.addClass('overflow-visible');
    const middleLayout = this.createSplitLayout([this.mainSlotWidget, bottomSlotWidget], [1, 0], {orientation: 'vertical', spacing: 0});
    const middleWidget = new TrackerSplitPanel({ layout: middleLayout });
    middleWidget.addClass('overflow-visible');
    return middleWidget;
  }

  updateResizeWidget() {
    this.layoutPanel.update();
    this.topBoxPanel.update();
  }

  initedLayout() {
    this.eventBus.fire(new InitedEvent());
  }

  destroy() {
    Widget.detach(this.topBarWidget);
    Widget.detach(this.horizontalPanel);
    Widget.detach(this.statusBarWidget);
  }
}
