import { WithEventBus, ComponentRegistryInfo, Emitter, Event, OnEvent, ResizeEvent, RenderedEvent, SlotLocation, CommandRegistry, localize } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { observable, action, observe } from 'mobx';
import { AbstractMenuService, IMenuRegistry, ICtxMenuRenderer, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');
export interface TabState {
  hidden: boolean;
}

@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  previousContainerId: string = '';

  @observable.shallow containersMap: Map<string, ComponentRegistryInfo> = new Map();
  @observable state: Map<string, TabState> = new Map();

  public prevSize?: number;

  resizeHandle: {
    setSize: (targetSize: number, isLatter: boolean) => void,
    getSize: (isLatter: boolean) => number,
  };

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(IMenuRegistry)
  protected menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  private readonly onCurrentChangeEmitter = new Emitter<{previousId: string; currentId: string}>();
  readonly onCurrentChange: Event<{previousId: string; currentId: string}> = this.onCurrentChangeEmitter.event;

  private barSize: number;
  private menuId = `tabbar/${this.location}`;

  constructor(public location: string) {
    super();
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerGlobalToggleCommand(),
        label: localize('layout.tabbar.hide', '隐藏'),
      },
      group: '0_global',
    });
  }

  public getContainerState(containerId: string) {
    let viewState = this.state.get(containerId);
    if (!viewState) {
      this.state.set(containerId, { hidden: false });
      viewState = this.state.get(containerId)!;
    }
    return viewState;
  }

  get visibleContainers() {
    const components: ComponentRegistryInfo[] = [];
    this.containersMap.forEach((component) => {
      const state = this.getContainerState(component.options!.containerId);
      if (!state.hidden) {
        components.push(component);
      }
    });
    return components;
  }

  registerResizeHandle(setSize, getSize, barSize) {
    this.barSize = barSize;
    this.resizeHandle = {setSize, getSize};
    this.listenCurrentChange();
  }

  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    this.containersMap.set(containerId, componentInfo);
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerVisibleToggleCommand(containerId),
        label: componentInfo.options!.title || '',
      },
      group: '1_widgets',
    });
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
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

  @action.bound handleContextMenu(event: React.MouseEvent, containerId: string) {
    event.preventDefault();
    const menus = this.menuService.createMenu(this.menuId);
    const menuNodes = generateCtxMenu({ menus, options: {args: [{containerId}]} });
    this.contextMenuRenderer.show({ menuNodes: menuNodes[1], anchor: {
      x: event.clientX,
      y: event.clientY,
    } });
  }

  private registerGlobalToggleCommand() {
    const commandId = `activity.bar.toggle.${this.location}`;
    this.commandRegistry.registerCommand({
      id: commandId,
    }, {
      execute: ({containerId}: {containerId: string}) => {
        this.doToggleTab(containerId);
      },
    });
    return commandId;
  }

  // 注册tab的隐藏显示功能
  private registerVisibleToggleCommand(containerId: string): string {
    const commandId = `activity.bar.toggle.${containerId}`;
    this.commandRegistry.registerCommand({
      id: commandId,
    }, {
      execute: ({forceShow}: {forceShow?: boolean}) => {
        this.doToggleTab(containerId, forceShow);
      },
      isToggled: () => {
        const state = this.getContainerState(containerId);
        return !state.hidden;
      },
    });
    return commandId;
  }

  protected doToggleTab(containerId: string, forceShow?: boolean) {
    const state = this.getContainerState(containerId);
    if (forceShow === undefined) {
      state.hidden = !state.hidden;
    } else {
      state.hidden = !forceShow;
    }
    if (state.hidden) {
      if (this.currentContainerId === containerId) {
        this.currentContainerId = this.visibleContainers[0].options!.containerId;
      }
    }
  }

  @OnEvent(RenderedEvent)
  protected async onRendered() {
    // accordion panel状态恢复
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
