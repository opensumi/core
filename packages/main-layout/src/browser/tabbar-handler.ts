import { Autowired, Injectable } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { IMainLayoutService } from '../common';

import { TabbarService } from './tabbar/tabbar.service';

import type { ViewBadge } from 'vscode';

@Injectable({ multiple: true })
export class TabBarHandler {
  @Autowired(IMainLayoutService)
  private layoutService!: IMainLayoutService;

  protected readonly onActivateEmitter = new Emitter<void>();
  readonly onActivate: Event<void> = this.onActivateEmitter.event;

  protected readonly onInActivateEmitter = new Emitter<void>();
  readonly onInActivate: Event<void> = this.onInActivateEmitter.event;

  // @deprecated
  protected readonly onCollapseEmitter = new Emitter<void>();
  protected readonly onCollapse: Event<void> = this.onCollapseEmitter.event;

  public isVisible = false;
  public accordionService = this.layoutService.getAccordionService(this.containerId);

  constructor(public readonly containerId: string, private tabbarService: TabbarService) {
    // 如果当前视图已经激活，则设置一些激活的标志
    if (tabbarService.currentContainerId.get() === this.containerId) {
      this.onActivateEmitter.fire();
      this.isVisible = true;
    }
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

  /**
   * dispose 整个视图面板
   */
  dispose() {
    // remove tab
    this.tabbarService.containersMap.delete(this.containerId);
    this.tabbarService.disposeContainer(this.containerId);
  }
  /**
   * dispose 子视图
   */
  disposeView(viewId: string) {
    this.layoutService.disposeViewComponent(viewId);
  }
  /**
   * 激活该视图
   */
  activate() {
    this.tabbarService.updateCurrentContainerId(this.containerId);
  }
  /**
   * 取消激活该视图
   */
  deactivate() {
    this.tabbarService.updateCurrentContainerId('');
  }
  /**
   * 当前视图激活状态
   */
  isActivated() {
    return this.tabbarService.currentContainerId.get() === this.containerId;
  }
  /**
   * 显示当前视图（区别于激活）
   */
  show() {
    this.tabbarService.showContainer(this.containerId);
  }
  /**
   * 隐藏当前视图（区别于取消激活，整个视图将不展示在 tabbar 上）
   */
  hide() {
    this.tabbarService.hideContainer(this.containerId);
  }
  /**
   * 设置视图的顶部标题组件
   */
  setTitleComponent(Fc: React.ComponentType, props?: object) {
    const component = this.tabbarService.getContainer(this.containerId);
    if (component && component.options) {
      component.options.titleProps = props;
      component.options.titleComponent = Fc;
      component.fireChange(component);
    }
  }
  /**
   * 设置当前视图的展开尺寸，会强制展开面板
   */
  setSize(size: number) {
    this.layoutService.toggleSlot(
      this.tabbarService.location,
      true,
      size + this.tabbarService.getBarSize() /* border宽(高)度*/,
    );
  }
  /**
   * 设置视图tab的徽标
   */
  setBadge(badge?: ViewBadge | string) {
    this.tabbarService.updateBadge(this.containerId, badge);
  }
  /**
   * 获取视图tab的徽标
   */
  getBadge() {
    return this.tabbarService.getContainer(this.containerId)!.options!.badge;
  }
  /**
   * 设置视图tab的图标
   */
  setIconClass(iconClass: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.iconClass = iconClass;
  }
  /**
   * 当前视图是否折叠（区别于激活，整个slot位置都会折叠）
   */
  isCollapsed(viewId: string) {
    return this.accordionService.getViewState(viewId).collapsed;
  }
  /**
   * 折叠视图所在位置
   */
  setCollapsed(viewId: string, collapsed: boolean) {
    this.accordionService.toggleOpen(viewId, collapsed);
  }
  /**
   * 切换子视图的折叠展开状态
   */
  toggleViews(viewIds: string[], show: boolean) {
    for (const viewId of viewIds) {
      const viewState = this.accordionService.getViewState(viewId);
      this.accordionService.updateViewState(viewId, { ...viewState, hidden: !show });
    }
  }
  /**
   * 更新子视图的标题
   */
  updateViewTitle(viewId: string, title: string) {
    this.accordionService.updateViewTitle(viewId, title);
  }

  /**
   * 更新子视图的描述
   */
  updateViewDescription(viewId: string, desciption: string | React.ReactNode) {
    this.accordionService.updateViewDesciption(viewId, desciption);
  }

  /**
   * 更新子视图的 message
   */
  updateViewMessage(viewId: string, message: string) {
    this.accordionService.updateViewMessage(viewId, message);
  }
  /**
   * 更新视图的标题
   */
  updateTitle(title: string) {
    this.tabbarService.updateTitle(this.containerId, title);
  }
  /**
   * 禁用侧边栏的resize功能
   */
  setResizeLock(lock?: boolean) {
    this.tabbarService.resizeHandle!.lockSize(lock);
  }
}
