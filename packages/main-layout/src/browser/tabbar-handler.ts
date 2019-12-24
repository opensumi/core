import { Event, Emitter } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { TabbarService } from './tabbar/tabbar.service';
import { IMainLayoutService } from '../common';

@Injectable({multiple: true})
export class TabBarHandler {
  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  protected readonly onActivateEmitter = new Emitter<void>();
  readonly onActivate: Event<void> = this.onActivateEmitter.event;

  protected readonly onInActivateEmitter = new Emitter<void>();
  readonly onInActivate: Event<void> = this.onInActivateEmitter.event;

  protected readonly onCollapseEmitter = new Emitter<void>();
  readonly onCollapse: Event<void> = this.onCollapseEmitter.event;

  public isVisible: boolean = false;
  public accordionService = this.layoutService.getAccordionService(this.containerId);

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

  disposeView(viewId: string) {
    const index = this.accordionService.views.findIndex((view) => view.id === viewId);
    this.accordionService.views.splice(index, 1);
  }

  activate() {
    this.tabbarService.currentContainerId = this.containerId;
  }

  isActivated() {
    return this.tabbarService.currentContainerId === this.containerId;
  }

  show() {
    this.tabbarService.getContainerState(this.containerId).hidden = false;
  }

  hide() {
    this.tabbarService.getContainerState(this.containerId).hidden = true;
  }

  setTitleComponent(Fc: React.FunctionComponent) {
    console.warn(`method setTitleComponent of TabBarHandler is deprecated!`);
    const componentInfo = this.tabbarService.getContainer(this.containerId);
    if (componentInfo) {
      componentInfo.options!.titleComponent = Fc;
    }
  }

  setSize(size: number) {
    this.layoutService.toggleSlot(this.tabbarService.location, true, size);
  }

  setBadge(badge: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.badge = badge;
  }

  setIconClass(iconClass: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.iconClass = iconClass;
  }

  isCollapsed(viewId: string) {
    return this.accordionService.getViewState(viewId).collapsed;
  }

  toggleViews(viewIds: string[], show: boolean) {
    for (const viewId of viewIds) {
      const viewState = this.accordionService.getViewState(viewId);
      viewState.hidden = !show;
    }
  }

  updateViewTitle(viewId: string, title: string) {
    const targetView = this.accordionService.views.find((view) => view.id === viewId);
    if (targetView) {
      targetView.name = title;
    } else {
      console.error('没有找到目标视图，无法更新手风琴标题!');
    }
  }

  refreshTitle() {
    console.warn(`method refreshTitle of TabBarHandler is deprecated!`);
  }

  updateTitle(label: string) {
    this.tabbarService.getContainer(this.containerId)!.options!.title = label;
  }

  setResizeLock(lock?: boolean) {
    this.tabbarService.resizeHandle.lockSize(lock);
  }
}
