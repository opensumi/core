import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject, Domain } from '@ali/common-di';
import {
  SplitPanel,
  SplitLayout,
  Widget,
  BoxLayout,
  BoxPanel,
} from '@phosphor/widgets';
import { IdeWidget } from './ide-widget.view';
import { AppConfig, getDomainConstructors, ModuleConstructor, Command, LayoutConfig, SlotLocation } from '@ali/ide-core-browser';
import { BottomPanelModule } from '@ali/ide-bottom-panel/lib/browser';
import { ActivityPanelModule } from '@ali/ide-activity-panel/lib/browser';
import { ActivityBarModule } from '@ali/ide-activity-bar/lib/browser';
import { Disposable } from '@ali/ide-core-browser';
import { ActivityBarService, Side } from '@ali/ide-activity-bar/lib/browser/activity-bar.service';
import { BottomPanelService } from '@ali/ide-bottom-panel/lib/browser/bottom-panel.service';
import { SplitPositionHandler } from './split-panels';
import { IEventBus, ContributionProvider } from '@ali/ide-core-common';
import { InitedEvent, VisibleChangedEvent, VisibleChangedPayload, IMainLayoutService, MainLayoutContribution, ComponentCollection, ViewToContainerMapData, RenderedEvent } from '../common';
import { ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ReactWidget } from './react-widget.view';
import { IWorkspaceService } from '@ali/ide-workspace';
import { ViewContainerOptions, View } from '@ali/ide-core-browser/lib/layout';
import { IconService } from '@ali/ide-theme/lib/browser/icon.service';

export interface TabbarWidget {
  widget: Widget;
  panel: Widget;
  size?: number;
}

export interface TabbarCollection extends ComponentCollection {
  side: string;
}

@Injectable()
export class MainLayoutService extends Disposable implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired()
  bottomPanelModule: BottomPanelModule;

  @Autowired()
  private activityBarService: ActivityBarService;

  @Autowired()
  private bottomPanelService: BottomPanelService;

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

  static initVerRelativeSizes = [4, 1];
  public verRelativeSizes = [MainLayoutService.initVerRelativeSizes];

  private configContext: AppConfig;

  private topBarWidget: IdeWidget;
  private mainSlotWidget: IdeWidget;
  private bottomBarWidget: IdeWidget;

  private bottomSlotWidget: Widget;
  private leftPanelWidget: Widget;
  private rightPanelWidget: Widget;
  private leftSlotWidget: Widget;

  private horizontalPanel: Widget;
  private middleWidget: SplitPanel;

  private layoutPanel: BoxPanel;
  private topBoxPanel: BoxPanel;

  private readonly tabbarMap: Map<SlotLocation, TabbarWidget> = new Map();

  public readonly tabbarComponents: TabbarCollection[] = [];

  // 从上到下包含顶部bar、中间横向大布局和底部bar
  createLayout(node: HTMLElement) {
    this.topBarWidget = this.initIdeWidget(SlotLocation.top);
    this.horizontalPanel = this.createSplitHorizontalPanel();
    this.bottomBarWidget = this.initIdeWidget(SlotLocation.bottom);

    // 设置id，配置样式
    this.topBarWidget.id = 'top-slot';
    this.horizontalPanel.id = 'main-box';
    this.bottomBarWidget.id = 'status-bar';

    const layout = this.createBoxLayout(
      [this.topBarWidget, this.horizontalPanel, this.bottomBarWidget],
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
      } else if (location === SlotLocation.bottomBar) {
        const { views, options } = this.getComponentInfoFrom(layoutConfig[location].modules[0]);
        const component = views && views.map((view) => view.component);
        const size = options ? options.size || 19 : 19;
        // TODO statusBar支持堆叠
        this.bottomBarWidget.node.style.minHeight = `${size}px`;
        this.bottomBarWidget.setComponent(component);
      }
    }
    // 声明式注册的Tabbar组件注册完毕，渲染数据
    const tabbarComponents = this.tabbarComponents;
    for (const tabbarItem of tabbarComponents) {
      this.registerTabbarComponent(tabbarItem.views || [], tabbarItem.options, tabbarItem.side || '');
    }
    this.activityBarService.refresh('left');
    this.activityBarService.refresh('right', true);
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidUseConfig) {
        contribution.onDidUseConfig();
      }
    }
    this.eventBus.fire(new RenderedEvent());
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
    switch (location) {
      case SlotLocation.bottom:
        this.changeVisibility(this.bottomSlotWidget, location, show);
        break;
      case SlotLocation.left:
      case SlotLocation.right:
        const tabbar = this.getTabbar(location as Side);
        await this.changeSideVisibility(tabbar.widget, location as Side, show, size);
        break;
      default:
        console.warn('未知的SlotLocation!');
    }
    if (show) {
      this.eventBus.fire(new VisibleChangedEvent(new VisibleChangedPayload(true, location)));
    } else {
      this.eventBus.fire(new VisibleChangedEvent(new VisibleChangedPayload(false, location)));
    }
  }

  isVisible(location: SlotLocation) {
    switch (location) {
      case SlotLocation.bottom:
        return this.bottomBarWidget.isVisible;
      case SlotLocation.left:
      case SlotLocation.right:
        const tabbar = this.getTabbar(location as Side);
        return tabbar.panel.isVisible;
      default:
        console.warn('未知的SlotLocation!');
        return false;
    }
  }

  // TODO 底部和左右侧统一实现
  async registerTabbarComponent(views: View[], options: ViewContainerOptions, side: string) {
    const { title } = options;
    if (options.icon) {
      options.iconClass = (await this.iconService.fromSVG(options.icon)) + ' ' + 'mask-mode';
    }
    if (side === SlotLocation.right || side === SlotLocation.left) {
      return this.activityBarService.append(views, options, side as Side);
    } else if (side === 'bottom') {
      const { component } = views[0];
      if (component) {
        this.bottomPanelService.append({ title: title!, component });
      }
    }
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

  // TODO 支持不使用Tabbar切换能力
  private createSplitHorizontalPanel() {
    const leftSlotWidget = this.createActivityWidget(SlotLocation.left);
    const rightSlotWidget = this.createActivityWidget(SlotLocation.right);
    this.middleWidget = this.createMiddleWidget();
    this.tabbarMap.set(SlotLocation.left, { widget: leftSlotWidget, panel: this.leftPanelWidget });
    this.tabbarMap.set(SlotLocation.right, { widget: rightSlotWidget, panel: this.rightPanelWidget });
    const horizontalSplitLayout = this.createSplitLayout([leftSlotWidget, this.middleWidget, rightSlotWidget], [0, 1, 0], { orientation: 'horizontal', spacing: 0 });
    const panel = new SplitPanel({ layout: horizontalSplitLayout });
    panel.id = 'main-split';
    return panel;
  }

  private async togglePanel(side: Side, show: boolean, size?: number) {
    const tabbar = this.getTabbar(side);
    const { widget, panel, size: domSize } = tabbar;
    if (show) {
      let lastPanelSize = this.configContext.layoutConfig[side].size || 400;
      // 初始化折叠会导致size获取为50
      if (domSize && domSize !== 50) {
        lastPanelSize = domSize;
      }
      if (size) {
        lastPanelSize = size;
      }
      panel.show();
      this.splitHandler.setSidePanelSize(widget, lastPanelSize, { side, duration: 0 });
    } else {
      tabbar.size = this.getPanelSize(side);
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
    activityBarWidget.id = 'activity-bar';
    const activityPanelWidget = this.initIdeWidget(side, panelComponent);
    if (side === SlotLocation.left) {
      this.leftPanelWidget = activityPanelWidget;
    } else {
      this.rightPanelWidget = activityPanelWidget;
    }
    const containerLayout = new BoxLayout({ direction: side === SlotLocation.left ? 'left-to-right' : 'right-to-left', spacing: 0 });
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

  private createMiddleWidget() {
    const middleWidget = new SplitPanel({ orientation: 'vertical', spacing: 0 });
    this.mainSlotWidget = this.initIdeWidget(SlotLocation.main);
    this.bottomSlotWidget = this.initIdeWidget(SlotLocation.bottom, this.bottomPanelModule.component);
    middleWidget.addWidget(this.mainSlotWidget);
    middleWidget.addWidget(this.bottomSlotWidget);
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
    Widget.detach(this.bottomBarWidget);
  }
}
