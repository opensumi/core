import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject, Domain } from '@ali/common-di';
import {
  SplitPanel,
  SplitLayout,
  Widget,
  BoxLayout,
  BoxPanel,
} from '@phosphor/widgets';
import { IdeWidget } from './ide-widget.view';
import { AppConfig, getDomainConstructors, ModuleConstructor, Command, LayoutConfig } from '@ali/ide-core-browser';
import { SlotLocation } from '../common/main-layout-slot';
import { BottomPanelModule } from '@ali/ide-bottom-panel/lib/browser';
import { ActivityPanelModule } from '@ali/ide-activity-panel/lib/browser';
import { ActivityBarModule } from '@ali/ide-activity-bar/lib/browser';
import { Disposable } from '@ali/ide-core-browser';
import { ActivityBarService, Side } from '@ali/ide-activity-bar/lib/browser/activity-bar.service';
import { BottomPanelService } from '@ali/ide-bottom-panel/lib/browser/bottom-panel.service';
import { SplitPositionHandler } from './split-panels';
import { IEventBus, ContributionProvider } from '@ali/ide-core-common';
import { InitedEvent, VisibleChangedEvent, VisibleChangedPayload, IMainLayoutService, ExtraComponentInfo, MainLayoutContribution, ExtComponentInfo } from '../common';
import { ComponentRegistry, ComponentInfo } from '@ali/ide-core-browser/lib/layout';
import { ReactWidget } from './react-widget.view';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

export interface TabbarWidget {
  widget: Widget;
  panel: Widget;
  size?: number;
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
  activityPanelModule: ActivityPanelModule;

  @Autowired()
  activityBarModule: ActivityBarModule;

  @Autowired()
  private activityBarService: ActivityBarService;

  @Autowired()
  private bottomPanelService: BottomPanelService;

  @Autowired()
  splitHandler: SplitPositionHandler;

  @Autowired(WorkspaceService)
  protected workspaceService: WorkspaceService;

  @Autowired(ComponentRegistry)
  componentRegistry: ComponentRegistry;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

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

  public readonly tabbarComponents: Array<{componentInfo: ComponentInfo, side: string}> = [];

  @Autowired()
  staticResourceService: StaticResourceService;

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
      {direction: 'top-to-bottom', spacing: 0},
    );
    this.layoutPanel = new BoxPanel({layout});
    this.layoutPanel.id = 'main-layout';
    Widget.attach(this.layoutPanel, node);
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidCreateSlot) {
        contribution.onDidCreateSlot();
      }
    }
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
          const { component, size = 0 } = this.getComponentInfoFrom(tokens[i]);
          widgets.push(new ReactWidget(configContext, component));
          widgets[i].node.style[targetSize] = `${size}px`;
          slotHeight += size;
        }
        const topSlotLayout = this.createBoxLayout(
          widgets, widgets.map(() => 0) as Array<number>, {direction: 'top-to-bottom', spacing: 0},
        );
        this.topBoxPanel = new BoxPanel({layout: topSlotLayout});
        this.topBarWidget.node.style.minHeight = this.topBoxPanel.node.style.height = `${slotHeight}px`;
        this.topBarWidget.setWidget(this.topBoxPanel);
      } else if (location === SlotLocation.main) {
        if (layoutConfig[location].modules[0]) {
          const { component } = this.getComponentInfoFrom(layoutConfig[location].modules[0]);
          this.mainSlotWidget.setComponent(component);
        }
      } else if (location === SlotLocation.left || location === SlotLocation.right || location === SlotLocation.bottom) {
        layoutConfig[location].modules.forEach((token) => {
          const componentInfo = this.getComponentInfoFrom(token);
          this.registerTabbarComponent(componentInfo, location);
        });
      } else if (location === SlotLocation.bottomBar) {
        const { component, size = 19 } = this.getComponentInfoFrom(layoutConfig[location].modules[0]);
        // TODO statusBar支持堆叠
        this.bottomBarWidget.node.style.minHeight = `${size}px`;
        this.bottomBarWidget.setComponent(component);
      }
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidUseConfig) {
        contribution.onDidUseConfig();
      }
    }
  }

  private getComponentInfoFrom(token: string | ModuleConstructor): ComponentInfo {
    let componentInfo;
    if (typeof token === 'string') {
      componentInfo = this.componentRegistry.getComponentInfo(token);
    } else {
      console.warn('直接传入Constructor的布局形式即将废弃，请使用contribution的形式注册');
      // 兼容传construtor模式
      const module = this.injector.get(token);
      componentInfo.component = module.component;
      componentInfo.title = module.title;
      componentInfo.iconClass = module.iconClass;
    }
    if (!componentInfo) {
      console.error(`模块${token}信息初始化失败`);
    }
    if (!componentInfo.component) {
      console.warn(`找不到${token}对应的组件！`);
      componentInfo.component = this.initIdeWidget();
    }
    return componentInfo;
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

  // TODO 运行时模块变化怎么支持？比如左侧的某个Panel拖到底部。底部单个模块兼容
  registerTabbarComponent(componentInfo: ComponentInfo, side: string) {
    const {component, title} = componentInfo;
    if (side === SlotLocation.right || side === SlotLocation.left) {
      return this.activityBarService.append(componentInfo, side as Side);
    } else if (side === 'bottom') {
      this.bottomPanelService.append({ title: title!, component });
    }
  }

  async collectTabbarComponent(componentInfo: ExtComponentInfo, side: string) {
    const randomIconClass = `icon-${Math.random().toString(36).slice(-8)}`;
    const iconUrl = (await this.staticResourceService.resolveStaticResource(componentInfo.icon)).toString();
    const cssRule = `.${randomIconClass} {-webkit-mask: url(${iconUrl}) no-repeat 50% 50%;}`;
    let iconStyleNode = document.getElementById('plugin-icons');
    if (!iconStyleNode) {
      iconStyleNode = document.createElement('style');
      iconStyleNode.id = 'plugin-icons';
      document.getElementsByTagName('head')[0].appendChild(iconStyleNode);
    }
    iconStyleNode.append(cssRule);
    componentInfo.iconClass = randomIconClass + ' ' + 'mask-mode';
    this.tabbarComponents.push({componentInfo, side});
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
    let lastPanelSize = this.configContext.layoutConfig[side].size || 400;
    // 初始化折叠会导致size获取为50
    if (domSize && domSize !== 50) {
      lastPanelSize = domSize;
    }
    if (size) {
      lastPanelSize = size;
    }
    if (show) {
      panel.show();
      widget.removeClass('collapse');
      this.splitHandler.setSidePanelSize(widget, lastPanelSize, { side, duration: 100 });
    } else {
      tabbar.size = this.getPanelSize(side);
      await this.splitHandler.setSidePanelSize(widget, 50, { side, duration: 100 });
      widget.addClass('collapse');
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
    const barComponent = this.getComponentInfoFrom(this.configContext.layoutConfig[SlotLocation[`${side}Bar`]].modules[0]).component;
    const panelComponent = this.getComponentInfoFrom(this.configContext.layoutConfig[SlotLocation[`${side}Panel`]].modules[0]).component;
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
