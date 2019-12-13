import { WithEventBus, ComponentRegistryInfo, Emitter, Event, OnEvent, ResizeEvent, RenderedEvent, SlotLocation, CommandRegistry, localize, KeybindingRegistry } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { observable, action, observe, computed } from 'mobx';
import { AbstractMenuService, IMenuRegistry, ICtxMenuRenderer, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');
export interface TabState {
  hidden: boolean;
}

@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  previousContainerId: string = '';

  // 由于 observable.map （即使是deep:false) 会把值转换成observableValue，不希望这样
  containersMap: Map<string, ComponentRegistryInfo> = new Map();
  @observable state: Map<string, TabState> = new Map();

  public prevSize?: number;

  resizeHandle: {
    setSize: (targetSize: number) => void,
    setRelativeSize: (prev: number, next: number) => void,
    getSize: () => number,
    getRelativeSize: () => number[],
  };

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(IMenuRegistry)
  protected menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired(KeybindingRegistry)
  keybindingRegistry: KeybindingRegistry;

  private readonly onCurrentChangeEmitter = new Emitter<{previousId: string; currentId: string}>();
  readonly onCurrentChange: Event<{previousId: string; currentId: string}> = this.onCurrentChangeEmitter.event;

  private readonly onSizeChangeEmitter = new Emitter<{size: number}>();
  readonly onSizeChange: Event<{size: number}> = this.onSizeChangeEmitter.event;

  private barSize: number;
  private menuId = `tabbar/${this.location}`;
  private isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;

  constructor(public location: string, public noAccordion?: boolean) {
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

  @computed({equals: visibleContainerEquals})
  get visibleContainers() {
    const components: ComponentRegistryInfo[] = [];
    this.containersMap.forEach((component) => {
      const state = this.state.get(component.options!.containerId);
      if (!state || !state.hidden) {
        components.push(component);
      }
    });
    const size = this.state.size; // 监听state长度
    return components.sort((pre, next) => (next.options!.priority || 1) - (pre.options!.priority || 1));
  }

  registerResizeHandle(setSize, setRelativeSize, getSize, getRelativeSize, barSize) {
    this.barSize = barSize;
    this.resizeHandle = {
      setSize: (size) => setSize(size, this.isLatter),
      setRelativeSize: (prev: number, next: number) => setRelativeSize(prev, next, this.isLatter),
      getSize: () => getSize(this.isLatter),
      getRelativeSize: () => getRelativeSize(this.isLatter),
    };
    this.listenCurrentChange();
  }

  @action
  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    let options = componentInfo.options;
    if (!options) {
      options = {
        containerId,
      };
      componentInfo.options = options;
    }
    this.containersMap.set(containerId, {
      views: componentInfo.views,
      options: observable.object(options, undefined, {deep: false}),
    });
    // 需要立刻设置，lazy 逻辑会导致computed 的 visibleContainers 可能在计算时触发变更，抛出mobx invariant错误
    // 另外由于containersMap不是observable, 这边setState来触发visibaleContainers更新
    this.state.set(containerId, {hidden: false});
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerVisibleToggleCommand(containerId),
        label: componentInfo.options!.title || '',
      },
      group: '1_widgets',
    });
    this.registerActivateKeyBinding(componentInfo);
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
  }

  getTitleToolbarMenu(containerId: string) {
    const menu = this.menuService.createMenu(`container/${containerId}`);
    return menu;
  }

  doExpand(expand: boolean) {
    const {setRelativeSize} = this.resizeHandle;
    if (expand) {
      if (!this.isLatter) {
        setRelativeSize(1, 0);
      } else {
        setRelativeSize(0, 1);
      }
    } else {
      // FIXME 底部需要额外的字段记录展开前的尺寸
      setRelativeSize(2, 1);
    }
  }

  get isExpanded(): boolean {
    const {getRelativeSize} = this.resizeHandle;
    const relativeSizes = getRelativeSize().join(',');
    return this.isLatter ? relativeSizes === '0,1' : relativeSizes === '1,0';
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

  // 注册Tab的激活快捷键，对于底部panel，为切换快捷键
  private registerActivateKeyBinding(component: ComponentRegistryInfo) {
    const options = component.options!;
    const containerId = options.containerId;
    if (!options.activateKeyBinding) {
      return;
    }
    const activateCommandId = `activity.panel.activate.${containerId}`;
    this.commandRegistry.registerCommand({
      id: activateCommandId,
    }, {
      execute: () => {
        // 支持toggle
        if (this.location === 'bottom') {
          this.currentContainerId = this.currentContainerId === containerId ? '' : containerId;
        } else {
          this.currentContainerId = containerId;
        }
      },
    });
    this.keybindingRegistry.registerKeybinding({
      command: activateCommandId,
      keybinding: options.activateKeyBinding,
    });
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

  protected shouldExpand(containerId: string) {
    const info = this.getContainer(containerId);
    return info && info.options && info.options.expanded;
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === this.location) {
      if (!this.currentContainerId) {
        // 折叠时不监听变化
        return;
      }
      const size = this.resizeHandle.getSize();
      if (size !== this.barSize && !this.shouldExpand(this.currentContainerId)) {
        this.prevSize = size;
        this.onSizeChangeEmitter.fire({size});
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
      const isCurrentExpanded = this.shouldExpand(currentId);
      if (this.shouldExpand(this.previousContainerId) || isCurrentExpanded) {
        this.handleFullExpanded(currentId, isCurrentExpanded);
      } else {
        if (currentId) {
          if (this.prevSize === undefined) {
            this.prevSize = getSize();
          }
          setSize(this.prevSize || 400);
        } else {
          this.prevSize = getSize();
          setSize(this.barSize);
        }
      }
    });
  }

  protected handleFullExpanded(currentId: string, isCurrentExpanded?: boolean) {
    const { setRelativeSize, setSize } = this.resizeHandle;
    if (currentId) {
      if (isCurrentExpanded) {
        if (!this.isLatter) {
          setRelativeSize(1, 0);
        } else {
          setRelativeSize(0, 1);
        }
      } else {
        setSize(this.prevSize || 400);
      }
    } else {
      setSize(this.barSize);
    }
  }

}

function visibleContainerEquals(a: ComponentRegistryInfo[], b: ComponentRegistryInfo[]): boolean {
  if (a.length !== b.length ) {
    return false;
  } else {
    for (let i = 0; i < a.length; i ++) {
      return a[i] === b[i];
    }
  }
  return true;
}
