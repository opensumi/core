import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Event, Emitter, CommandService, IEventBus } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { TabbarService, TabbarServiceFactory } from './tabbar/tabbar.service';

@Injectable({multiple: true})
export class TabBarHandler {

  protected readonly onActivateEmitter = new Emitter<void>();
  readonly onActivate: Event<void> = this.onActivateEmitter.event;

  protected readonly onInActivateEmitter = new Emitter<void>();
  readonly onInActivate: Event<void> = this.onInActivateEmitter.event;

  protected readonly onCollapseEmitter = new Emitter<void>();
  readonly onCollapse: Event<void> = this.onCollapseEmitter.event;

  public isVisible: boolean = false;

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
  }

  dispose() {
    // remove tab
    this.tabbarService.containersMap.delete(this.containerId);
  }

  // TODO
  disposeView(viewId: string) {
    console.warn(this.containerId + ':disposeView方法在handler中暂未实现');
  }

  activate() {
    this.tabbarService.currentContainerId = this.containerId;
  }

  isActivated() {
    return this.tabbarService.currentContainerId === this.containerId;
  }

  show() {
    console.warn(this.containerId + ':show方法在handler中暂未实现');
  }

  hide() {
    console.warn(this.containerId + ':hide方法在handler中暂未实现');
  }

  // @deprecated 设定title自定义组件，应通过contribution声明
  setTitleComponent(Fc: React.FunctionComponent) {
    const componentInfo = this.tabbarService.getContainer(this.containerId);
    if (componentInfo) {
      componentInfo.options!.titleComponent = Fc;
    }
  }

  setSize(size: number) {
    console.warn(this.containerId + ':setSize方法在handler中暂未实现');
  }

  setBadge(badge: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.badge = badge;
  }

  setIconClass(iconClass: string) {
    console.warn(this.containerId + ':setIconClass方法在handler中暂未实现');
  }

  isCollapsed(viewId: string) {
    console.warn(this.containerId + ':isCollapsed方法在handler中暂未实现');
    return false;
  }

  // 有多个视图请一次性注册，否则会影响到视图展开状态！
  toggleViews(viewIds: string[], show: boolean) {
    console.warn(this.containerId + ':toggleViews方法在handler中暂未实现');
  }

  // @deprecated
  updateViewTitle(viewId: string, title: string) {
    console.warn(this.containerId + ':updateViewTitle方法在handler中已被废弃');
  }

  // @deprecated
  refreshTitle() {
    console.warn(this.containerId + ':refreshTitle方法在handler中已被废弃');
  }

  // @deprecated 更新 title
  updateTitle(label: string) {
    console.warn(this.containerId + ':updateTitle方法在handler中已被废弃');
  }
}
