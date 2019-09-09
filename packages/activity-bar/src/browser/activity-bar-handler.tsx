import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Title, Widget, BoxPanel } from '@phosphor/widgets';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { AppConfig, ConfigProvider, SlotRenderer } from '@ali/ide-core-browser';
import { Event, Emitter, CommandService } from '@ali/ide-core-common';
import { ViewsContainerWidget } from '@ali/ide-activity-panel/lib/browser/views-container-widget';
import { View, ITabbarWidget, Side } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanelToolbar } from '@ali/ide-activity-panel/lib/browser/activity-panel-toolbar';

export class ActivityBarHandler {

  private widget: BoxPanel = this.title.owner as BoxPanel;
  private titleWidget: ActivityPanelToolbar = (this.title.owner as BoxPanel).widgets[0] as ActivityPanelToolbar;
  private containerWidget: ViewsContainerWidget = (this.title.owner as BoxPanel).widgets[1] as ViewsContainerWidget;

  protected readonly onActivateEmitter = new Emitter<void>();
  readonly onActivate: Event<void> = this.onActivateEmitter.event;

  protected readonly onInActivateEmitter = new Emitter<void>();
  readonly onInActivate: Event<void> = this.onInActivateEmitter.event;

  protected readonly onCollapseEmitter = new Emitter<void>();
  readonly onCollapse: Event<void> = this.onCollapseEmitter.event;

  public isVisible: boolean = false;

  constructor(
    private containerId,
    private title: Title<Widget>,
    private activityBar: ITabbarWidget,
    private side: Side,
    private commandService: CommandService,
    private configContext: AppConfig) {
    this.activityBar.currentChanged.connect((tabbar, args) => {
      const { currentWidget, previousWidget } = args;
      if (currentWidget === this.widget) {
        this.onActivateEmitter.fire();
        this.isVisible = true;
      } else if (previousWidget === this.widget) {
        this.onInActivateEmitter.fire();
        this.isVisible = false;
      }
    });
    this.activityBar.onCollapse.connect((tabbar, title) => {
      if (this.widget.title === title) {
        this.onCollapseEmitter.fire();
      }
    });
    // TODO 底部panel的visible状态
  }

  dispose() {
    this.activityBar.tabBar.removeTab(this.title);
  }

  activate() {
    // 底部的显示隐藏为slot能力，不受Tabbar控制
    if (this.side === 'bottom') {
      this.commandService.executeCommand('main-layout.bottom-panel.show');
    }
    this.activityBar.currentWidget = this.widget;
  }

  show() {
    this.commandService.executeCommand(`activity.bar.toggle.${this.containerId}`, true);
  }

  hide() {
    this.commandService.executeCommand(`activity.bar.toggle.${this.containerId}`, false);
  }

  // 设定container整个组件
  setComponent(Fc: React.FunctionComponent | React.FunctionComponent[]) {
    ReactDOM.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={Fc} />
      </ConfigProvider>
    , this.widget.node);
  }

  // 设定title自定义组件，注意设置高度
  setTitleComponent(Fc: React.FunctionComponent, size?: number) {
    this.titleWidget.setComponent(Fc, size);
  }

  // TODO 底部待实现
  setSize(size: number) {
    this.activityBar.showPanel(size);
  }
  // TODO 底部待实现
  setBadge(badge: string) {
    // @ts-ignore
    this.title.badge = badge;
    this.activityBar.tabBar.update();
  }

  setIconClass(iconClass: string) {
    this.title.iconClass = iconClass;
  }

  registerView(view: View, component: React.FunctionComponent<any>, props?: any) {
    this.containerWidget.addWidget(view, component, props);
  }

  isCollapsed(viewId: string) {
    const section = this.containerWidget.sections.get(viewId);
    if (!section) {
      console.error('没有找到对应的view!');
    } else {
      return !section.opened;
    }
  }

  toggleViews(viewIds: string[], show: boolean) {
    for (const viewId of viewIds) {
      const section = this.containerWidget.sections.get(viewId);
      if (!section) {
        console.warn(`没有找到${viewId}对应的视图，跳过`);
        continue;
      }
      this.commandService.executeCommand(`view-container.toggle.${viewId}}`, show);
    }
  }

  updateTitle() {
    this.titleWidget.update();
  }
}
