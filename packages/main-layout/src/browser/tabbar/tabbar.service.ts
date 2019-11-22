import { WithEventBus, ComponentRegistryInfo, Emitter, Event, ViewContextKeyRegistry, IContextKeyService, TabBarToolbar, ToolbarRegistry, OnEvent, ResizeEvent, RenderedEvent, SlotLocation } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, action, observe } from 'mobx';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';
import { MenuService } from '@ali/ide-core-browser/lib/menu/next';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');

// TODO 存尺寸，存状态
@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  previousContainerId: string = '';

  @observable.shallow containersMap: Map<string, ComponentRegistryInfo> = new Map();

  public prevSize?: number;

  resizeHandle: {
    setSize: (targetSize: number, isLatter: boolean) => void,
    getSize: (isLatter: boolean) => number,
  };

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  @Autowired()
  protected readonly ToolbarRegistry: ToolbarRegistry;

  @Autowired(MenuService)
  protected menuService: MenuService;

  private readonly onCurrentChangeEmitter = new Emitter<{previousId: string; currentId: string}>();
  readonly onCurrentChange: Event<{previousId: string; currentId: string}> = this.onCurrentChangeEmitter.event;

  private toolbar: TabBarToolbar;

  private barSize: number;

  constructor(public location: string) {
    super();
  }

  registerResizeHandle(setSize, getSize, barSize) {
    this.barSize = barSize;
    this.resizeHandle = {setSize, getSize};
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

  getTitleToolbarMenu(containerId: string) {
    const menu = this.menuService.createMenu(`container/${containerId}`);
    return menu;
  }

  @action.bound handleTabClick(
    e: React.MouseEvent,
    forbidCollapse?: boolean) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId && !forbidCollapse) {
      this.currentContainerId = '';
    } else {
      this.currentContainerId = containerId;
    }
  }

  @OnEvent(RenderedEvent)
  protected async onRendered() {
    for (const component of this.containersMap.values()) {
      const accordion = this.viewContainerRegistry.getAccordion(component.options!.containerId);
      if (accordion) {
        await accordion.restoreState();
      }
    }
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === this.location) {
      const isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
      const size = this.resizeHandle.getSize(isLatter);
      if (size !== this.barSize) {
        this.prevSize = size;
      }
    }
  }

  protected listenCurrentChange() {
    const {getSize, setSize} = this.resizeHandle;
    observe(this, 'currentContainerId', (change) => {
      if (this.prevSize === undefined) {
      }
      this.previousContainerId = change.oldValue || '';
      const currentId = change.newValue;
      this.onCurrentChangeEmitter.fire({previousId: change.oldValue || '', currentId});
      const isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
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
        }
        if (this.prevSize === undefined) {
          this.prevSize = getSize(isLatter);
        }
        setSize(this.prevSize || 400, isLatter);
      } else {
        this.prevSize = getSize(isLatter);
        setSize(this.barSize, isLatter);
      }
    });
  }

}
