import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Title, Widget, BoxPanel } from '@phosphor/widgets';
import { AppConfig, ConfigProvider, ComponentRenderer, SlotLocation, IContextKeyService } from '@ali/ide-core-browser';
import { Event, Emitter, CommandService, IEventBus } from '@ali/ide-core-common';
import { View, ITabbarWidget, Side, VisibleChangedEvent, VisibleChangedPayload } from '@ali/ide-core-browser/lib/layout';
import { AccordionWidget } from '@ali/ide-core-browser/lib/layout/accordion/accordion.widget';
import { Injectable, Autowired } from '@ali/common-di';
import { ActivityPanelToolbar } from '@ali/ide-core-browser/lib/layout/view-container-toolbar';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';
import { TabbarService, TabbarServiceFactory } from './tabbar/tabbar.service';

@Injectable({multiple: true})
export class TabBarHandler {

  private titleWidget?: ActivityPanelToolbar;
  private accordion?: AccordionWidget;

  protected readonly onActivateEmitter = new Emitter<void>();
  readonly onActivate: Event<void> = this.onActivateEmitter.event;

  protected readonly onInActivateEmitter = new Emitter<void>();
  readonly onInActivate: Event<void> = this.onInActivateEmitter.event;

  protected readonly onCollapseEmitter = new Emitter<void>();
  readonly onCollapse: Event<void> = this.onCollapseEmitter.event;

  public isVisible: boolean = false;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  // FIXME panel类型的tababr和侧边栏的tabbar需要一个标志来判断
  constructor(private containerId: string, private tabbarService: TabbarService) {
    this.tabbarService.onCurrentChange((e) => {
      if (e.currentId === this.containerId) {
        this.onActivateEmitter.fire();
        this.isVisible = true;
      } else if (e.previousId === this.containerId) {
        this.onInActivateEmitter.fire();
        this.isVisible = false;
      }
    });
    this.titleWidget = this.viewContainerRegistry.getTitleBar(this.containerId);
    this.accordion = this.viewContainerRegistry.getAccordion(this.containerId);
  }

  dispose() {
    // remove tab
    this.tabbarService.containersMap.delete(this.containerId);
  }

  disposeView(viewId: string) {
    if (this.accordion) {
      this.accordion.removeWidget(viewId);
    }
  }

  activate() {
    this.tabbarService.currentContainerId = this.containerId;
  }

  isActivated() {
    return this.tabbarService.currentContainerId === this.containerId;
  }

  show() {

  }

  hide() {

  }

  // 设定title自定义组件，注意设置高度
  setTitleComponent(Fc: React.FunctionComponent, size?: number) {

  }

  setSize(size: number) {
    // command
  }

  setBadge(badge: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.badge = badge;
  }

  setIconClass(iconClass: string) {

  }

  isCollapsed(viewId: string) {
    if (!this.accordion) {
      return;
    }
    const section = this.accordion.sections.get(viewId);
    if (!section) {
      console.error('没有找到对应的view!');
    } else {
      return section.collapsed;
    }
  }

  // 有多个视图请一次性注册，否则会影响到视图展开状态！
  toggleViews(viewIds: string[], show: boolean) {
    if (!this.accordion) {
      return;
    }
    for (const viewId of viewIds) {
      const section = this.accordion.sections.get(viewId);
      if (!section) {
        console.warn(`没有找到${viewId}对应的视图，跳过`);
        continue;
      }
      section.setHidden(!show);
    }
    this.accordion.updateTitleVisibility();
  }

  updateViewTitle(viewId: string, title: string) {

  }

  // 刷新 title
  refreshTitle() {

  }

  // 更新 title
  updateTitle(label: string) {

  }
}
