import { WithEventBus, ComponentRegistryInfo, Emitter, Event, OnEvent, ResizeEvent, RenderedEvent, SlotLocation, CommandRegistry, localize, KeybindingRegistry, ViewContextKeyRegistry, IContextKeyService } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, action, observe, computed } from 'mobx';
import { AbstractContextMenuService, AbstractMenuService, IContextMenu, IMenuRegistry, ICtxMenuRenderer, generateCtxMenu, IMenu, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { TOGGLE_BOTTOM_PANEL_COMMAND, EXPAND_BOTTOM_PANEL, RETRACT_BOTTOM_PANEL } from '../main-layout.contribution';
import { ResizeHandle } from '@ali/ide-core-browser/lib/components';
import debounce = require('lodash.debounce');
import { TabBarRegistrationEvent, IMainLayoutService } from '../../common';
import { AccordionService } from '../accordion/accordion.service';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');
export interface TabState {
  hidden: boolean;
}
const INIT_PANEL_SIZE = 280;

@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  previousContainerId: string = '';

  // 由于 observable.map （即使是deep:false) 会把值转换成observableValue，不希望这样
  containersMap: Map<string, ComponentRegistryInfo> = new Map();
  @observable state: Map<string, TabState> = new Map();

  public prevSize?: number;
  public commonTitleMenu: IContextMenu;

  resizeHandle: {
    setSize: (targetSize: number) => void,
    setRelativeSize: (prev: number, next: number) => void,
    getSize: () => number,
    getRelativeSize: () => number[],
    lockSize: (lock: boolean | undefined) => void,
    setMaxSize: (lock: boolean | undefined) => void,
    hidePanel: (show?: boolean) => void,
  };

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  private readonly ctxmenuService: AbstractContextMenuService;

  @Autowired(IMenuRegistry)
  protected menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired(KeybindingRegistry)
  keybindingRegistry: KeybindingRegistry;

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  private accordionRestored: Set<string> = new Set();

  private readonly onCurrentChangeEmitter = new Emitter<{previousId: string; currentId: string}>();
  readonly onCurrentChange: Event<{previousId: string; currentId: string}> = this.onCurrentChangeEmitter.event;

  private readonly onSizeChangeEmitter = new Emitter<{size: number}>();
  readonly onSizeChange: Event<{size: number}> = this.onSizeChangeEmitter.event;

  public barSize: number;
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
    if (this.location === 'bottom') {
      this.registerPanelMenus();
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

  private updatePanel = debounce((show) => {
    if (this.resizeHandle) {
      this.resizeHandle.hidePanel(show);
    }
  }, 60);

  public updatePanelVisibility(show: boolean) {
    this.updatePanel(show);
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
    return components.sort((pre, next) => (next.options!.priority !== undefined ? next.options!.priority : 1) - (pre.options!.priority !== undefined ? pre.options!.priority : 1));
  }

  registerResizeHandle(resizeHandle: ResizeHandle) {
    const {setSize, setRelativeSize, getSize, getRelativeSize, lockSize, setMaxSize, hidePanel} = resizeHandle;
    this.resizeHandle = {
      setSize: (size) => setSize(size, this.isLatter),
      setRelativeSize: (prev: number, next: number) => setRelativeSize(prev, next, this.isLatter),
      getSize: () => getSize(this.isLatter),
      getRelativeSize: () => getRelativeSize(this.isLatter),
      setMaxSize: (lock: boolean | undefined) => setMaxSize(lock, this.isLatter),
      lockSize: (lock: boolean | undefined) => lockSize(lock, this.isLatter),
      hidePanel: (show) => hidePanel(show),
    };
    this.listenCurrentChange();
  }

  @action
  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    if (this.containersMap.has(containerId)) {
      return;
    }
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
    this.updatePanelVisibility(this.containersMap.size > 0);

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
    this.registerActivateKeyBinding(componentInfo, options.fromExtension);
    this.eventBus.fire(new TabBarRegistrationEvent({tabBarId: containerId}));
    if (containerId === this.currentContainerId) {
      // 需要重新触发currentChange副作用
      this.handleChange(containerId, '');
    }
    this.viewContextKeyRegistry.registerContextKeyService(containerId, this.contextKeyService.createScoped()).createKey('view', containerId);
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
  }

  getTitleToolbarMenu(containerId: string) {
    const menu = this.menuService.createMenu(MenuId.ViewTitle, this.viewContextKeyRegistry.getContextKeyService(containerId));
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
    const menuNodes = generateCtxMenu({ menus, args: [{containerId}] });
    this.contextMenuRenderer.show({ menuNodes: menuNodes[1], anchor: {
      x: event.clientX,
      y: event.clientY,
    } });
  }

  // 注册Tab的激活快捷键，对于底部panel，为切换快捷键
  private registerActivateKeyBinding(component: ComponentRegistryInfo, fromExtension?: boolean) {
    const options = component.options!;
    const containerId = options.containerId;
    if (!options.activateKeyBinding) {
      return;
    }
    // vscode内插件注册的是workbench.view.extension.containerId
    const activateCommandId = fromExtension ? `workbench.view.extension.${containerId}` : `workbench.view.${containerId}`;
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

  protected registerPanelMenus() {
    this.menuRegistry.registerMenuItems('tabbar/bottom/common', [
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
    ]);
    this.commonTitleMenu = this.ctxmenuService.createMenu({
      id: 'tabbar/bottom/common',
    });
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
    observe(this, 'currentContainerId', (change) => {
      if (this.prevSize === undefined) {
      }
      this.previousContainerId = change.oldValue || '';
      const currentId = change.newValue;
      this.handleChange(currentId, this.previousContainerId);
    });
  }

  private handleChange(currentId, previousId) {
    const {getSize, setSize, lockSize, setMaxSize} = this.resizeHandle;
    this.onCurrentChangeEmitter.fire({previousId, currentId});
    const isCurrentExpanded = this.shouldExpand(currentId);
    if (this.shouldExpand(this.previousContainerId) || isCurrentExpanded) {
      this.handleFullExpanded(currentId, isCurrentExpanded);
    } else {
      if (currentId) {
        if (previousId && currentId !== previousId) {
          this.prevSize = getSize();
        }
        setSize(this.prevSize || (INIT_PANEL_SIZE + this.barSize));
        const containerInfo = this.getContainer(currentId);
        if (containerInfo && containerInfo.options!.noResize) {
          lockSize(true);
        } else {
          lockSize(false);
        }
        setMaxSize(false);
        if (!this.noAccordion) {
          this.tryRestoreAccordionSize(currentId);
        }
      } else {
        setSize(this.barSize);
        lockSize(true);
        setMaxSize(true);
      }
    }
  }

  protected tryRestoreAccordionSize(containerId: string) {
    if (this.accordionRestored.has(containerId)) {
      return;
    }
    const accordionService = this.layoutService.getAccordionService(containerId);
    // 需要保证此时tab切换已完成dom渲染
    setTimeout(() => {
      accordionService.restoreState();
      this.accordionRestored.add(containerId);
    }, 0);
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
        setSize(this.prevSize || INIT_PANEL_SIZE + this.barSize);
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
