import { Injectable, Autowired } from '@opensumi/di';
import { Event, Emitter, ILogger } from '@opensumi/ide-core-common';

import { IMainLayoutService } from '../common';

import { TabbarService } from './tabbar/tabbar.service';


@Injectable({ multiple: true })
export class TabBarHandler {
  @Autowired(IMainLayoutService)
  private layoutService!: IMainLayoutService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

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
    this.tabbarService.currentContainerId = this.containerId;
  }
  /**
   * 取消激活该视图
   */
  deactivate() {
    this.tabbarService.currentContainerId = '';
  }
  /**
   * 当前视图激活状态
   */
  isActivated() {
    return this.tabbarService.currentContainerId === this.containerId;
  }
  /**
   * 显示当前视图（区别于激活）
   */
  show() {
    this.tabbarService.getContainerState(this.containerId).hidden = false;
  }
  /**
   * 隐藏当前视图（区别于取消激活，整个视图将不展示在 tabbar 上）
   */
  hide() {
    this.tabbarService.getContainerState(this.containerId).hidden = true;
  }
  /**
   * 设置视图的顶部标题组件
   */
  setTitleComponent(Fc: React.ComponentType, props?: object) {
    const componentInfo = this.tabbarService.getContainer(this.containerId);
    if (componentInfo) {
      componentInfo.options!.titleProps = props;
      componentInfo.options!.titleComponent = Fc;
      this.tabbarService.forceUpdate++;
    }
  }
  /**
   * 设置当前视图的展开尺寸，会强制展开面板
   */
  setSize(size: number) {
    this.layoutService.toggleSlot(
      this.tabbarService.location,
      true,
      size + this.tabbarService.barSize /* border宽(高)度*/,
    );
  }
  /**
   * 设置视图tab的徽标
   */
  setBadge(badge: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.badge = badge;
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
      viewState.hidden = !show;
    }
  }
  /**
   * 更新子视图的标题
   */
  updateViewTitle(viewId: string, title: string) {
    const targetView = this.accordionService.views.find((view) => view.id === viewId);
    if (targetView) {
      targetView.name = title;
      this.accordionService.forceUpdate++;
    } else {
      this.logger.error('没有找到目标视图，无法更新手风琴标题!');
    }
  }
  /**
   * 更新视图的标题
   */
  updateTitle(label: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.title = label;
  }
  /**
   * 禁用侧边栏的resize功能
   */
  setResizeLock(lock?: boolean) {
    this.tabbarService.resizeHandle!.lockSize(lock);
  }
}
