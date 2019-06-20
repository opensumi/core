import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Inject } from '@ali/common-di';
import {
  SplitPanel,
  Widget,
} from '@phosphor/widgets';
import { IdeWidget } from './ide-widget.view';
import { AppConfig } from '@ali/ide-core-browser';
import { SlotLocation } from '../common/main-layout-slot';
import { BottomPanelModule } from '@ali/ide-bottom-panel/lib/browser';
import { ActivatorPanelModule } from '@ali/ide-activator-panel/lib/browser';
import { ActivatorBarModule } from '@ali/ide-activator-bar/lib/browser';
import { Disposable } from '@ali/ide-core-browser';
import { ActivatorBarService } from '@ali/ide-activator-bar/lib/browser/activator-bar.service';
import { BottomPanelService } from '@ali/ide-bottom-panel/lib/browser/bottom-panel.service';

@Injectable()
export class MainLayoutShell extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  bottomPanelModule: BottomPanelModule;

  @Autowired()
  activatorPanelModule: ActivatorPanelModule;

  @Autowired()
  activatorBarModule: ActivatorBarModule;

  @Autowired()
  private activityBarService: ActivatorBarService;

  @Autowired()
  private bottomPanelService: BottomPanelService;

  static initHorRelativeSizes = [1, 3, 1];
  static initVerRelativeSizes = [3, 1];
  public horRelativeSizes = [MainLayoutShell.initHorRelativeSizes];
  public verRelativeSizes = [MainLayoutShell.initVerRelativeSizes];

  private configContext: AppConfig;

  private topBarWidget: IdeWidget;
  private mainSlotWidget: IdeWidget;
  private bottomBarWidget: IdeWidget;

  private bottomSlotWidget: Widget;
  private activatorPanelWidget: Widget;
  private subsidiaryWidget: Widget;

  private horizontalPanel: Widget;
  private middleWidget: SplitPanel;
  private resizePanel: SplitPanel;

  // 从上到下包含顶部bar、中间横向大布局和底部bar
  createLayout(node: HTMLElement) {
    this.topBarWidget = this.initIdeWidget(SlotLocation.top);
    this.horizontalPanel = this.createHorizontalPanel();
    this.bottomBarWidget = this.initIdeWidget(SlotLocation.bottom);

    // 设置id，配置样式
    this.topBarWidget.id = 'menu-bar';
    this.horizontalPanel.id = 'main-box';
    this.bottomBarWidget.id = 'status-bar';

    Widget.attach(this.topBarWidget, node);
    Widget.attach(this.horizontalPanel, node);
    Widget.attach(this.bottomBarWidget, node);
  }

  // TODO 后续可以把配置和contribution整合起来
  useConfig(configContext: AppConfig, node: HTMLElement) {
    this.configContext = configContext;
    this.createLayout(node);

    const { layoutConfig } = configContext;
    for (const location of Object.keys(layoutConfig)) {
      // TODO 没有Tabbar的位置只支持一个
      if (location === 'top') {
        const module = this.injector.get(layoutConfig[location].modules[0]);
        this.topBarWidget.setComponent(module.component);
      } else if (location === 'main') {
        const module = this.injector.get(layoutConfig[location].modules[0]);
        this.mainSlotWidget.setComponent(module.component);
      } else if (location === 'left' || location === 'bottom') {
        layoutConfig[location].modules.forEach((Module) => {
          const module = this.injector.get(Module);
          const useTitle = location === 'bottom';
          this.registerTabbarComponent(module.component as React.FunctionComponent, useTitle ? module.title : module.iconClass, location);
        });
      } else if (location === 'bottomBar') {
        const module = this.injector.get(layoutConfig[location].modules[0]);
        this.bottomBarWidget.setComponent(module.component);
      }
    }
  }

  togglePanel(location: SlotLocation, show?: boolean) {
    switch (location) {
      case SlotLocation.bottom:
        this.changeVisibility(this.bottomSlotWidget, location, show);
        break;
      case SlotLocation.left:
        this.changeVisibility(this.activatorPanelWidget, location, show);
        break;
      case SlotLocation.right:
        this.changeVisibility(this.subsidiaryWidget, location, show);
        break;
      default:
        console.warn('未知的SlotLocation!');
    }
  }

  registerTabbarComponent(component: React.FunctionComponent, extra, side: string) {
    if (side === 'left') {
      this.activityBarService.append({iconClass: extra, component});
    } else if (side === 'bottom') {
      this.bottomPanelService.append({title: extra, component});
    }
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

  private showWidget(widget: Widget, location: SlotLocation) {
    widget.show();
    if (location === SlotLocation.bottom) {
      this.middleWidget.setRelativeSizes(this.verRelativeSizes.pop() || MainLayoutShell.initVerRelativeSizes);
    } else {
      this.resizePanel.setRelativeSizes(this.horRelativeSizes.pop() || MainLayoutShell.initHorRelativeSizes);
    }
  }

  private hideWidget(widget: Widget, location: SlotLocation) {
    if (location === SlotLocation.bottom) {
      this.verRelativeSizes.push(this.middleWidget.relativeSizes());
    } else {
      this.horRelativeSizes.push(this.resizePanel.relativeSizes());
    }
    widget.hide();
  }

  private initIdeWidget(location?: string, component?: React.FunctionComponent) {
    return this.injector.get(IdeWidget, [this.configContext, component, location]);
  }

  // 包含固定宽度的 activatorBar和支持resize的右侧组件整体[activatorPanel, middleWidget, subsidiaryWidget]
  private createHorizontalPanel() {
    const horizontalBoxPanel = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
    // TODO 对于不需要resize的组件，SlotLocation好像没必要
    const activatorBarWidget = this.initIdeWidget(undefined, this.activatorBarModule.component);
    activatorBarWidget.id = 'activator-bar';

    this.resizePanel = this.createResizePanel();
    horizontalBoxPanel.addWidget(activatorBarWidget);
    horizontalBoxPanel.addWidget(this.resizePanel);
    return horizontalBoxPanel;
  }

  private createResizePanel() {
    const resizePanel = new SplitPanel({ orientation: 'horizontal', spacing: 0 });
    this.activatorPanelWidget = this.initIdeWidget(SlotLocation.left, this.activatorPanelModule.component);
    this.middleWidget = this.createMiddleWidget();
    this.subsidiaryWidget = this.initIdeWidget(SlotLocation.right);
    resizePanel.addWidget(this.activatorPanelWidget);
    resizePanel.addWidget(this.middleWidget);
    resizePanel.addWidget(this.subsidiaryWidget);
    // 初始化相对宽度
    resizePanel.setRelativeSizes(this.horRelativeSizes.pop() || MainLayoutShell.initHorRelativeSizes);
    return resizePanel;
  }

  private createMiddleWidget() {
    const middleWidget = new SplitPanel({orientation: 'vertical', spacing: 0});
    this.mainSlotWidget = this.initIdeWidget(SlotLocation.main);
    this.bottomSlotWidget = this.initIdeWidget(SlotLocation.bottom, this.bottomPanelModule.component);
    middleWidget.addWidget(this.mainSlotWidget);
    middleWidget.addWidget(this.bottomSlotWidget);
    middleWidget.setRelativeSizes(this.verRelativeSizes.pop() || MainLayoutShell.initVerRelativeSizes);
    return middleWidget;
  }

  updateResizeWidget() {
    this.horizontalPanel.update();
    this.middleWidget.update();
  }

  destroy() {
    Widget.detach(this.topBarWidget);
    Widget.detach(this.horizontalPanel);
    Widget.detach(this.bottomBarWidget);
  }
}
