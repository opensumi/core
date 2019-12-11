import { WithEventBus, ComponentRegistryInfo, Emitter, Event, OnEvent, ResizeEvent, RenderedEvent, SlotLocation, CommandRegistry, localize, KeybindingRegistry } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { observable, action, observe, computed } from 'mobx';
import { AbstractMenuService, IMenuRegistry, ICtxMenuRenderer, generateCtxMenu, IMenu } from '@ali/ide-core-browser/lib/menu/next';
import { TOGGLE_BOTTOM_PANEL_COMMAND, EXPAND_BOTTOM_PANEL, RETRACT_BOTTOM_PANEL } from '../main-layout.contribution';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');
export interface TabState {
  hidden: boolean;
}

@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  previousContainerId: string = '';

  containersMap: Map<string, ComponentRegistryInfo> = new Map();
  @observable state: Map<string, TabState> = new Map();

  public prevSize?: number;
  public commonTitleMenu: IMenu;

  resizeHandle: {
    setSize: (targetSize: number, isLatter: boolean) => void,
    setRelativeSize: (prev: number, next: number, isLatter: boolean) => void,
    getSize: (isLatter: boolean) => number,
    getRelativeSize: (isLatter: boolean) => number[],
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

  constructor(public location: string) {
    super();
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerGlobalToggleCommand(),
        label: localize('layout.tabbar.hide', '隐藏'),
      },
      group: '0_global',
    });
    if (this.location === 'bottom') {
      this.menuRegistry.registerMenuItems(`tabbar/${this.location}/common`, [
        {
          command: {
            id: EXPAND_BOTTOM_PANEL.id,
            label: localize('layout.tabbar.expand', '最大化面板'),
          },
          group: 'navigation',
          when: '!bottomFullExpanded',
          order: 1,
        },
        {
          command: {
            id: RETRACT_BOTTOM_PANEL.id,
            label: localize('layout.tabbar.retract', '恢复面板'),
          },
          group: 'navigation',
          when: 'bottomFullExpanded',
          order: 1,
        },
        {
          command: {
            id: TOGGLE_BOTTOM_PANEL_COMMAND.id,
            label: localize('layout.tabbar.hide', '收起面板'),
          },
          group: 'navigation',
          order: 2,
        },
        {
          command: {
            id: TOGGLE_BOTTOM_PANEL_COMMAND.id,
            label: localize('layout.tabbar.hide', '收起面板'),
          },
        },
      ]);
      this.commonTitleMenu = this.menuService.createMenu(`tabbar/${this.location}/common`);
    }
  }

  public getContainerState(containerId: string) {
    let viewState = this.state.get(containerId);
    if (!viewState) {
      this.state.set(containerId, { hidden: false });
      viewState = this.state.get(containerId)!;
    }
    return viewState;
  }

  @computed({equals: (a: ComponentRegistryInfo[], b: ComponentRegistryInfo[]) => a.length === b.length})
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

  registerResizeHandle(setSize, setRelativeSize, getSize, getRelativeSize, barSize) {
    this.barSize = barSize;
    this.resizeHandle = {setSize, setRelativeSize, getSize, getRelativeSize};
    this.listenCurrentChange();
  }

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
    const isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
    const {setRelativeSize} = this.resizeHandle;
    if (expand) {
      if (!isLatter) {
        setRelativeSize(1, 0, isLatter);
      } else {
        setRelativeSize(0, 1, isLatter);
      }
    } else {
      // FIXME 底部需要额外的字段记录展开前的尺寸
      setRelativeSize(2, 1, isLatter);
    }
  }

  get isExpanded(): boolean {
    const isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
    const {getRelativeSize} = this.resizeHandle;
    const relativeSizes = getRelativeSize(isLatter).join(',');
    return isLatter ? relativeSizes === '0,1' : relativeSizes === '1,0';
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
      const isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
      const size = this.resizeHandle.getSize(isLatter);
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
      }
    });
  }

  protected handleFullExpanded(currentId: string, isCurrentExpanded?: boolean) {
    const { setRelativeSize, setSize } = this.resizeHandle;
    const isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
    if (currentId) {
      if (isCurrentExpanded) {
        if (!isLatter) {
          setRelativeSize(1, 0, isLatter);
        } else {
          setRelativeSize(0, 1, isLatter);
        }
      } else {
        setSize(this.prevSize || 400, isLatter);
      }
    } else {
      setSize(this.barSize, isLatter);
    }
  }

}
