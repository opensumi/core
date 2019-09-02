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
import { SplitPositionHandler } from './split-panels';
import { IEventBus, ContributionProvider, StorageProvider, STORAGE_NAMESPACE, IStorage, WithEventBus, OnEvent } from '@ali/ide-core-common';
import { InitedEvent, VisibleChangedEvent, VisibleChangedPayload, IMainLayoutService, MainLayoutContribution, ComponentCollection, ViewToContainerMapData, RenderedEvent } from '../common';
import { ComponentRegistry, ResizeEvent } from '@ali/ide-core-browser/lib/layout';
import { ReactWidget } from './react-widget.view';
import { IWorkspaceService } from '@ali/ide-workspace';
import { ViewContainerOptions, View } from '@ali/ide-core-browser/lib/layout';
import { IconService } from '@ali/ide-theme/lib/browser/icon.service';
import { IdeWidget } from '@ali/ide-core-browser/lib/layout/ide-widget.view';

export interface TabbarWidget {
  widget: Widget;
  panel: Widget;
  size?: number;
  resizeTimer?: any;
}

export interface TabbarCollection extends ComponentCollection {
  side: string;
}

type LayoutState = {
  [side in Side]: {
    size: number;
  }
};

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

  @Autowired()
  private iconService: IconService;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  static initVerRelativeSizes = [4, 1];
  public verRelativeSizes = [MainLayoutService.initVerRelativeSizes];

  private configContext: AppConfig;

  private topBarWidget: IdeWidget;
  private mainSlotWidget: IdeWidget;
  private bottomSlotWidget: BoxPanel;
  private statusBarWidget: IdeWidget;

  private leftPanelWidget: Widget;
  private rightPanelWidget: Widget;
  private bottomPanelWidget: Widget;

  private horizontalPanel: Widget;
  private middleWidget: SplitPanel;

  private layoutPanel: BoxPanel;
  private topBoxPanel: BoxPanel;

  private readonly tabbarMap: Map<SlotLocation, TabbarWidget> = new Map();

  public readonly tabbarComponents: TabbarCollection[] = [];

  private layoutState: LayoutState;
  private layoutStorage: IStorage;
  private restoring: boolean = true;

  // 从上到下包含顶部bar、中间横向大布局和底部bar
  createLayout(node: HTMLElement) {
    this.topBarWidget = this.initIdeWidget(SlotLocation.top);
    this.horizontalPanel = this.createSplitHorizontalPanel();
    this.statusBarWidget = this.initIdeWidget(SlotLocation.bottom);

    // 设置id，配置样式
    this.topBarWidget.id = 'top-slot';
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
            console.warn('请在options内传入containerId!');
          }
          this.collectTabbarComponent(views || [], options || {containerId: token}, location);
        });
      } else if (location === SlotLocation.statusBar) {
        const { views, options } = this.getComponentInfoFrom(layoutConfig[location].modules[0]);
        const component = views && views.map((view) => view.component);
        const size = options ? options.size || 19 : 19;
        // TODO statusBar支持堆叠
        this.statusBarWidget.node.style.minHeight = `${size}px`;
        this.statusBarWidget.setComponent(component);
      }
    }
    // 声明式注册的Tabbar组件注册完毕，渲染数据
    const tabbarComponents = this.tabbarComponents;
    for (const tabbarItem of tabbarComponents) {
      this.registerTabbarComponent(tabbarItem.views || [], tabbarItem.options, tabbarItem.side || '');
    }
    this.activityBarService.refresh('left');
    this.activityBarService.refresh('right', true);
    this.activityBarService.refresh('bottom');
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidUseConfig) {
        contribution.onDidUseConfig();
      }
    }
    this.eventBus.fire(new RenderedEvent());
  }

  public async restoreState() {
    const defaultState = {
      left: {
        size: 400,
      },
      right: {
        size: 400,
      },
      bottom: {
        size: 200,
      },
    };
    this.layoutStorage = await this.getStorage(STORAGE_NAMESPACE.LAYOUT);
    try {
      this.layoutState = JSON.parse(this.layoutStorage.get('size', JSON.stringify(defaultState)));
    } catch (err) {
      console.warn('Layout state parse出错，使用默认state');
      this.layoutState = defaultState;
    }
    this.restoring = false;
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    const side = e.payload.slotLocation as Side;
    if (side === SlotLocation.left || side === SlotLocation.right || side === SlotLocation.bottom) {
      const tabbarInfo = this.tabbarMap.get(side) as TabbarWidget;
      clearTimeout(tabbarInfo.resizeTimer);
      tabbarInfo.resizeTimer = setTimeout(() => {
        if (side !== 'bottom') {
          this.storeState(side, e.payload.width);
        } else {
          this.storeState(side, e.payload.height);
        }
      }, 60);
    }
  }

  private storeState(side: Side, size: number) {
    if (this.restoring) { return; }
    this.layoutState[side].size = size;
    this.layoutStorage.set('size', JSON.stringify(this.layoutState));
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

  async toggleSlot(location: SlotLocation, show?: boolean, size?: number) {
    if (location === SlotLocation.bottom) {
      return this.changeVisibility(this.bottomSlotWidget, location, show);
    } else {
      const tabbar = this.getTabbar(location as Side);
      await this.changeSideVisibility(tabbar.widget, location as Side, show, size);
    }
    if (show) {
      this.eventBus.fire(new VisibleChangedEvent(new VisibleChangedPayload(true, location)));
    } else {
      this.eventBus.fire(new VisibleChangedEvent(new VisibleChangedPayload(false, location)));
    }
  }

  isVisible(location: SlotLocation) {
    const tabbar = this.getTabbar(location as Side);
    return tabbar.panel.isVisible;
  }

  registerTabbarComponent(views: View[], options: ViewContainerOptions, side: string) {
    if (options.icon) {
      options.iconClass = this.iconService.fromSVG(options.icon) + ' ' + 'mask-mode';
    }
    return this.activityBarService.append(views, options, side as Side);
  }

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string): string {
    this.tabbarComponents.push({
      views,
      options,
      side,
    });
    return options.containerId!;
  }

  private changeVisibility(widget, location: SlotLocation, show?: boolean) {
    if (show === true) {
      this.showWidget(widget, location);
    } else if (show === false) {
      this.hideWidget(widget, location);
    } else {
      widget.isHidden ? this.showWidget(widget, location) : this.hideWidget(widget, location);
    }
  }

  private async changeSideVisibility(widget, location: Side, show?: boolean, size?: number) {
    if (typeof show === 'boolean') {
      await this.togglePanel(location, show, size);
    } else {
      widget.isHidden ? await this.togglePanel(location, true, size) : await this.togglePanel(location, false, size);
    }
  }

  private showWidget(widget: Widget, location: SlotLocation) {
    widget.show();
    if (location === SlotLocation.bottom) {
      this.middleWidget.setRelativeSizes(this.verRelativeSizes.pop() || MainLayoutService.initVerRelativeSizes);
    }
  }

  private hideWidget(widget: Widget, location: SlotLocation) {
    if (location === SlotLocation.bottom) {
      this.verRelativeSizes.push(this.middleWidget.relativeSizes());
    }
    widget.hide();
  }

  private initIdeWidget(location?: string, component?: React.FunctionComponent) {
    return this.injector.get(IdeWidget, [this.configContext, component, location]);
  }

  private createSplitHorizontalPanel() {
    const leftSlotWidget = this.createActivityWidget(SlotLocation.left);
    const rightSlotWidget = this.createActivityWidget(SlotLocation.right);
    this.bottomSlotWidget = this.createActivityWidget(SlotLocation.bottom);
    this.middleWidget = this.createMiddleWidget(this.bottomSlotWidget);
    this.tabbarMap.set(SlotLocation.left, { widget: leftSlotWidget, panel: this.leftPanelWidget });
    this.tabbarMap.set(SlotLocation.right, { widget: rightSlotWidget, panel: this.rightPanelWidget });
    this.tabbarMap.set(SlotLocation.bottom, { widget: this.bottomSlotWidget, panel: this.bottomPanelWidget });
    const horizontalSplitLayout = this.createSplitLayout([leftSlotWidget, this.middleWidget, rightSlotWidget], [0, 1, 0], { orientation: 'horizontal', spacing: 0 });
    const panel = new SplitPanel({ layout: horizontalSplitLayout });
    panel.addClass('overflow-visible');
    return panel;
  }

  private async togglePanel(side: Side, show: boolean, size?: number) {
    const tabbar = this.getTabbar(side);
    const { widget, panel, size: domSize } = tabbar;
    if (show) {
      let lastPanelSize = this.layoutState[side].size || this.configContext.layoutConfig[side].size || 400;
      if (size) {
        lastPanelSize = size;
      } else if (domSize && domSize !== 50) {
        // 初始化折叠会导致size获取为50
        lastPanelSize = domSize;
      }
      panel.show();
      this.splitHandler.setSidePanelSize(widget, lastPanelSize, { side, duration: 0 });
    } else {
      const size = this.getPanelSize(side);
      tabbar.size = size;
      if (size !== 50) {
        this.storeState(side, size);
      }
      this.splitHandler.setSidePanelSize(widget, 50, { side, duration: 0 });
      panel.hide();
    }
  }

  private getPanelSize(side: Side) {
    const tabbar = this.getTabbar(side);
    return tabbar.widget.node.clientWidth;
  }

  private getTabbar(side: Side): TabbarWidget {
    const tabbar = this.tabbarMap.get(side) as TabbarWidget;
    if (!tabbar) {
      console.warn('没有找到这个位置的Tabbar!');
    }
    return tabbar;
  }

  private createActivityWidget(side: string) {
    const barViews = this.getComponentInfoFrom(this.configContext.layoutConfig[SlotLocation[`${side}Bar`]].modules[0]).views;
    const panelViews = this.getComponentInfoFrom(this.configContext.layoutConfig[SlotLocation[`${side}Panel`]].modules[0]).views;
    const barComponent = barViews && barViews[0].component;
    const panelComponent = panelViews && panelViews[0].component;
    const activityBarWidget = this.initIdeWidget(`${side}Bar`, barComponent);
    activityBarWidget.id = side === 'bottom' ? 'bottom-bar' : 'activity-bar';
    const activityPanelWidget = this.initIdeWidget(side, panelComponent);
    let direction: BoxLayout.Direction = 'left-to-right';
    if (side === SlotLocation.left) {
      this.leftPanelWidget = activityPanelWidget;
    } else if (side === SlotLocation.right) {
      this.rightPanelWidget = activityPanelWidget;
      direction = 'right-to-left';
    } else {
      this.bottomPanelWidget = activityPanelWidget;
      direction = 'top-to-bottom';
    }
    const containerLayout = new BoxLayout({ direction, spacing: 0 });
    BoxPanel.setStretch(activityBarWidget, 0);
    containerLayout.addWidget(activityBarWidget);
    BoxPanel.setStretch(activityPanelWidget, 1);
    containerLayout.addWidget(activityPanelWidget);

    const activitorWidget = new BoxPanel({ layout: containerLayout });
    activitorWidget.id = `${side}-slot`;
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
  protected createSplitLayout(widgets: Widget[], stretch?: number[], options?: Partial<SplitLayout.IOptions>): SplitLayout {
    let optParam: SplitLayout.IOptions = { renderer: SplitPanel.defaultRenderer };
    if (options) {
      optParam = { ...optParam, ...options };
    }
    const splitLayout = new SplitLayout(optParam);
    for (let i = 0; i < widgets.length; i++) {
      if (stretch !== undefined && i < stretch.length) {
        SplitPanel.setStretch(widgets[i], stretch[i]);
      }
      splitLayout.addWidget(widgets[i]);
    }
    return splitLayout;
  }

  private createMiddleWidget(bottomSlotWidget: Widget) {
    const middleWidget = new SplitPanel({ orientation: 'vertical', spacing: 0 });
    this.mainSlotWidget = this.initIdeWidget(SlotLocation.main);
    this.mainSlotWidget.addClass('overflow-visible');
    middleWidget.addWidget(this.mainSlotWidget);
    middleWidget.addClass('overflow-visible');
    middleWidget.addWidget(bottomSlotWidget);
    middleWidget.setRelativeSizes(this.verRelativeSizes.pop() || MainLayoutService.initVerRelativeSizes);
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
