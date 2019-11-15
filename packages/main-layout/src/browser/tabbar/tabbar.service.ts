import { WithEventBus, ComponentRegistryInfo, Emitter, Event, ViewContextKeyRegistry, IContextKeyService, TabBarToolbar, TabBarToolbarRegistry } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, action, observe } from 'mobx';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');

// TODO 存尺寸，存状态
@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  @observable.shallow containersMap: Map<string, ComponentRegistryInfo> = new Map();

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  @Autowired()
  protected readonly tabBarToolbarRegistry: TabBarToolbarRegistry;

  private readonly onCurrentChangeEmitter = new Emitter<{previousId: string; currentId: string}>();
  readonly onCurrentChange: Event<{previousId: string; currentId: string}> = this.onCurrentChangeEmitter.event;

  private prevSize?: number;

  private toolbar: TabBarToolbar;

  constructor(public location: string) {
    super();
    this.listenCurrentChange();
  }

  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    this.containersMap.set(containerId, componentInfo);
    this.viewContextKeyRegistry.registerContextKeyService(containerId, this.contextKeyService.createScoped()).createKey('view', containerId);
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
  }

  // TODO 底部控制，需要与侧边栏的形式统一
  registerToolbar(toolbar: TabBarToolbar) {
    this.toolbar = toolbar;
  }

  @action.bound handleTabClick(
    e: React.MouseEvent,
    setSize: (size: number, side: string) => void,
    getSize: (side: string) => number,
    forbidCollapse?: boolean) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId && !forbidCollapse) {
      this.prevSize = getSize(this.location);
      this.currentContainerId = '';
      setSize(50, this.location);
    } else {
      if (this.prevSize === undefined) {
        this.prevSize = getSize(this.location);
      }
      this.currentContainerId = containerId;
      setSize(this.prevSize || 400, this.location);
    }
  }

  // TODO 将setSize挪到这
  protected listenCurrentChange() {
    observe(this, 'currentContainerId', (change) => {
      if (this.prevSize === undefined) {
      }
      const currentId = change.newValue;
      this.onCurrentChangeEmitter.fire({previousId: change.oldValue || '', currentId});
      if (currentId) {
        const currentTitleBar = this.viewContainerRegistry.getTitleBar(currentId)!;
        const accordion = this.viewContainerRegistry.getAccordion(currentId)!;
        if (currentTitleBar && accordion) {
          const visibleViews = accordion.getVisibleSections().map((section) => section.view.id);
          if (visibleViews.length === 1) {
            currentTitleBar.updateToolbar(visibleViews[0]);
          } else {
            currentTitleBar.updateToolbar();
            accordion.update();
          }
        } else {
          if (this.toolbar) {
            const containerItems = this.tabBarToolbarRegistry.visibleItems(currentId);
            this.toolbar.updateItems(containerItems);
          }
        }
      }
    });
  }

}
