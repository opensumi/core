import debounce from 'lodash/debounce';

import { Autowired, Injectable, Injector } from '@opensumi/di';
import {
  CommandRegistry,
  ComponentRegistryInfo,
  ComponentRegistryProvider,
  Deferred,
  DisposableCollection,
  Emitter,
  Event,
  IContextKey,
  IContextKeyService,
  IScopedContextKeyService,
  KeybindingRegistry,
  ResizeEvent,
  SlotLocation,
  ViewContextKeyRegistry,
  WithEventBus,
  createFormatLocalizedStr,
  fastdom,
  formatLocalize,
  getTabbarCtxKey,
  isDefined,
  isUndefined,
  localize,
  toDisposable,
} from '@opensumi/ide-core-browser';
import { SCM_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { LAYOUT_STATE, LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import {
  AbstractContextMenuService,
  AbstractMenuService,
  IContextMenu,
  ICtxMenuRenderer,
  IMenu,
  IMenuRegistry,
  MenuId,
  generateCtxMenu,
  getTabbarCommonMenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import {
  autorunDelta,
  derivedOpts,
  observableFromEventOpts,
  observableValue,
  transaction,
} from '@opensumi/ide-monaco/lib/common/observable';

import { IMainLayoutService, SUPPORT_ACCORDION_LOCATION, TabBarRegistrationEvent } from '../../common';
import { EXPAND_BOTTOM_PANEL, RETRACT_BOTTOM_PANEL, TOGGLE_BOTTOM_PANEL_COMMAND } from '../main-layout.contribution';

import type { ViewBadge } from 'vscode';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');
export const TabbarServiceFactoryFn = (injector: Injector) => (location: string) => {
  const manager: IMainLayoutService = injector.get(IMainLayoutService);
  return manager.getTabbarService(location);
};

export interface TabState {
  hidden: boolean;
  // 排序位置，数字越小优先级越高
  priority: number;
}
const CONTAINER_NAME_MAP = {
  left: 'view',
  right: 'extendView',
  bottom: 'panel',
};

const NONE_CONTAINER_ID = undefined;

@Injectable({ multiple: true })
export class TabbarService extends WithEventBus {
  private readonly doChangeViewEmitter = new Emitter<void>();
  private readonly shouldChangeView = observableFromEventOpts<void>(
    { owner: this, equalsFn: () => false },
    this.doChangeViewEmitter.event,
    () => void 0,
  );
  private readonly containerIdObs = observableValue<string | undefined>(this, NONE_CONTAINER_ID);

  public readonly currentContainerId = derivedOpts(
    {
      owner: this,
      // 每次有事件变化，都需要更新视图
      equalsFn: () => false,
    },
    (reader) => {
      this.shouldChangeView.read(reader);
      return this.containerIdObs.read(reader);
    },
  );

  private nextContainerId = '';
  private useFirstContainerId = false;

  public previousContainerId: string | undefined = undefined;
  public containersMap: Map<string, ComponentRegistryProvider> = new Map();
  public prevSize?: number;
  public commonTitleMenu: IContextMenu;
  public viewReady = new Deferred<void>();

  private state: Map<string, TabState> = new Map();
  private storedState: { [containerId: string]: TabState } = {};

  resizeHandle?: {
    setSize: (targetSize?: number) => void;
    setRelativeSize: (prev: number, next: number) => void;
    getSize: () => number;
    getRelativeSize: () => number[];
    lockSize: (lock: boolean | undefined) => void;
    setMaxSize: (lock: boolean | undefined) => void;
    hidePanel: (show?: boolean) => void;
  };

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  private readonly ctxMenuService: AbstractContextMenuService;

  @Autowired(IMenuRegistry)
  protected menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired(KeybindingRegistry)
  private keybindingRegistry: KeybindingRegistry;

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(IProgressService)
  private progressService: IProgressService;

  private accordionRestored: Set<string> = new Set();

  private readonly onCurrentChangeEmitter = new Emitter<{ previousId: string; currentId: string }>();
  readonly onCurrentChange: Event<{ previousId: string; currentId: string }> = this.onCurrentChangeEmitter.event;

  private readonly onSizeChangeEmitter = new Emitter<{ size: number }>();
  readonly onSizeChange: Event<{ size: number }> = this.onSizeChangeEmitter.event;

  protected barSize: number;
  protected panelSize: number;
  private menuId = `tabbar/${this.location}`;
  private moreMenuId = `tabbar/${this.location}/more`;
  private activatedKey: IContextKey<string>;
  private sortedContainers: Array<ComponentRegistryInfo> = [];
  private disposableMap: Map<string, DisposableCollection> = new Map();
  private tabInMoreKeyMap: Map<string, IContextKey<boolean>> = new Map();
  private shouldWaitForViewRender = false;
  private isLatter: boolean;

  private scopedCtxKeyService: IScopedContextKeyService;
  private onDidRegisterContainerEmitter = new Emitter<string>();
  private isEmptyTabbar = true;

  constructor(public location: string) {
    super();
    this.setIsLatter(location === SlotLocation.right || location === SlotLocation.bottom);
    this.scopedCtxKeyService = this.contextKeyService.createScoped();
    this.scopedCtxKeyService.createKey('triggerWithTab', true);
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerGlobalToggleCommand(),
        label: localize('layout.tabbar.toggle'),
      },
      group: '0_global',
      when: 'triggerWithTab == true',
    });
    this.activatedKey = this.contextKeyService.createKey(getTabbarCtxKey(this.location), '');
    if (this.location === 'bottom') {
      this.registerPanelCommands();
      this.registerPanelMenus();
    }

    this.eventBus.onDirective(ResizeEvent.createDirective(this.location), () => {
      this.onResize();
    });
  }

  get onDidRegisterContainer() {
    return this.onDidRegisterContainerEmitter.event;
  }

  public setIsLatter(v: boolean) {
    this.isLatter = v;
  }

  updateNextContainerId(nextContainerId?: string) {
    if (isUndefined(nextContainerId)) {
      this.useFirstContainerId = true;
    } else {
      this.nextContainerId = nextContainerId;
    }
  }

  updateCurrentContainerId(containerId: string) {
    transaction((tx) => {
      this.containerIdObs.set(containerId, tx);
    });
  }

  updateBadge(containerId: string, value?: ViewBadge | string) {
    const component = this.getContainer(containerId);
    if (component && component.options) {
      component.options.badge = value;
    }
    component?.fireChange(component);
  }

  registerPanelCommands(): void {
    this.commandRegistry.registerCommand(EXPAND_BOTTOM_PANEL, {
      execute: () => {
        this.layoutService.expandBottom(true);
      },
    });
    this.commandRegistry.registerCommand(RETRACT_BOTTOM_PANEL, {
      execute: () => {
        this.layoutService.expandBottom(false);
      },
    });
    this.commandRegistry.registerCommand(TOGGLE_BOTTOM_PANEL_COMMAND, {
      execute: (show?: boolean, size?: number) => {
        this.layoutService.toggleSlot(SlotLocation.bottom, show, size);
      },
    });
  }

  public getContainerState(containerId: string) {
    const viewState = this.state.get(containerId);
    return viewState!;
  }

  public hideContainer(containerId: string) {
    const viewState = this.state.get(containerId);
    if (viewState) {
      viewState.hidden = true;
    }
  }

  public showContainer(containerId: string) {
    const viewState = this.state.get(containerId);
    if (viewState) {
      viewState.hidden = false;
    }
  }

  private updatePanel = debounce((show) => {
    if (this.resizeHandle) {
      this.resizeHandle.hidePanel(show);
    }
  }, 60);

  public updatePanelVisibility(show?: boolean) {
    if (show === undefined) {
      show = this.containersMap.size > 0;
    }
    this.updatePanel(show);
  }

  public ensureViewReady() {
    if (isDefined(this.barSize) && isDefined(this.panelSize)) {
      this.resolveViewReady();
    } else {
      this.shouldWaitForViewRender = true;
    }
  }

  // 这里通过 panelSize 及 barSize 两个值去判断视图是否渲染完成
  public updatePanelSize(value: number) {
    this.panelSize = value;
    if (isDefined(this.barSize) && this.shouldWaitForViewRender) {
      this.resolveViewReady();
    }
  }

  public updateBarSize(value: number) {
    this.barSize = value;
    if (isDefined(this.panelSize) && this.shouldWaitForViewRender) {
      this.resolveViewReady();
    }
  }

  private resolveViewReady() {
    // 需要额外判断对应视图中是否已经注册有视图，如无，则等待注册后再进行视图渲染
    if (!this.isEmptyTabbar) {
      this.viewReady.resolve();
    } else {
      Event.once(this.onDidRegisterContainer)(() => {
        this.viewReady.resolve();
      });
    }
  }

  public getBarSize() {
    return this.barSize;
  }

  public updateTabInMoreKey(containerId: string, value: boolean) {
    const ctxKey = this.tabInMoreKeyMap.get(containerId);
    if (ctxKey) {
      ctxKey.set(value);
    }
  }

  get visibleContainers() {
    const components: ComponentRegistryProvider[] = [];
    this.containersMap.forEach((component) => {
      const state = component.options && this.state.get(component.options.containerId);
      if (!state || !state.hidden) {
        components.push(component);
      }
    });
    // 排序策略：默认根据priority来做一次排序，后续根据存储的index来排序，未存储过的（新插入的，比如插件）在渲染后（时序控制）始终放在最后
    // 排序为 state的 priority 从小到大 (注意和 componentInfo 中的 options 的 priority的含义不同，为了不breaking change，保留这种语义)
    return components.sort(
      (pre, next) =>
        this.getContainerState(pre.options!.containerId).priority -
        this.getContainerState(next.options!.containerId).priority,
    );
  }

  registerResizeHandle(resizeHandle: ResizeHandle) {
    const { setSize, setRelativeSize, getSize, getRelativeSize, lockSize, setMaxSize, hidePanel } = resizeHandle;
    this.resizeHandle = {
      setSize: (size) => setSize(size, this.isLatter),
      setRelativeSize: (prev: number, next: number) => setRelativeSize(prev, next, this.isLatter),
      getSize: () => getSize(this.isLatter),
      getRelativeSize: () => getRelativeSize(this.isLatter),
      setMaxSize: (lock: boolean | undefined) => setMaxSize(lock, this.isLatter),
      lockSize: (lock: boolean | undefined) => lockSize(lock, this.isLatter),
      hidePanel: (show) => hidePanel(show),
    };
    return this.listenCurrentChange();
  }

  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    if (this.containersMap.has(containerId)) {
      return;
    }

    if (this.useFirstContainerId) {
      this.useFirstContainerId = false;
      this.updateCurrentContainerId(containerId);
    }

    if (this.nextContainerId === containerId) {
      this.updateCurrentContainerId(containerId);
    }

    const disposables = new DisposableCollection();
    const options = componentInfo.options || { containerId };
    componentInfo.options = options;
    const componentChangeEmitter = new Emitter<ComponentRegistryProvider>();
    this.containersMap.set(containerId, {
      fireChange: (component: ComponentRegistryProvider) => componentChangeEmitter.fire(component),
      onChange: componentChangeEmitter.event,
      views: componentInfo.views,
      options,
    });

    disposables.push({
      dispose: () => {
        this.containersMap.delete(containerId);
        this.state.delete(containerId);
      },
    });

    this.updatePanelVisibility(this.containersMap.size > 0);

    // 由于 containersMap 不是可观察的，使用 setState 会触发 visibleContainers 的更新。
    // 在注册过程中，根据优先级对组件进行排序。
    // 在恢复状态时，组件将按照先前的顺序进行恢复（除了在 onDidStart 之后注册的视图，它们没有顺序恢复的能力）。
    let insertIndex = this.sortedContainers.findIndex(
      (item) => (item.options?.priority || 1) <= (componentInfo.options?.priority || 1),
    );
    if (insertIndex === -1) {
      insertIndex = this.sortedContainers.length;
    }
    this.sortedContainers.splice(insertIndex, 0, componentInfo);
    for (let i = insertIndex; i < this.sortedContainers.length; i++) {
      const info = this.sortedContainers[i];
      const containerId = info.options?.containerId;
      if (containerId) {
        const prevState = this.storedState[containerId] || this.getContainerState(containerId) || {}; // 保留原有的hidden状态
        this.state.set(containerId, { hidden: prevState.hidden, priority: i });
      }
    }
    disposables.push(this.registerSideEffects(componentInfo));

    this.eventBus.fire(new TabBarRegistrationEvent({ tabBarId: containerId }));

    if (containerId === this.currentContainerId.get()) {
      this.handleChange(containerId, '');
    }

    this.viewContextKeyRegistry
      .registerContextKeyService(containerId, this.contextKeyService.createScoped())
      .createKey('view', containerId);

    if (this.isEmptyTabbar) {
      this.isEmptyTabbar = false;
    }
    this.disposableMap.set(containerId, disposables);
    this.onDidRegisterContainerEmitter.fire(containerId);
  }

  registerSideEffects(componentInfo: ComponentRegistryInfo) {
    const disposables = new DisposableCollection();
    if (!componentInfo.options?.hideTab) {
      // 注册切换tab显隐的菜单
      disposables.push(this.registerHideMenu(componentInfo));
      // 注册溢出后的菜单
      disposables.push(this.registerMoreMenu(componentInfo));
    }
    // 注册激活快捷键
    disposables.push(this.registerActivateKeyBinding(componentInfo, componentInfo.options!.fromExtension));
    // 注册视图是否存在的contextKey
    const containerExistKey = this.contextKeyService.createKey<boolean>(
      `workbench.${CONTAINER_NAME_MAP[this.location] || 'view'}.${componentInfo.options!.containerId}`,
      true,
    );
    disposables.push({
      dispose: () => {
        containerExistKey.set(false);
      },
    });
    // 注册progressIndicator
    disposables.push(this.progressService.registerProgressIndicator(componentInfo.options!.containerId));
    disposables.push(this.registerContainerPanelRelatedCommand(componentInfo));
    return disposables;
  }
  /**
   * 这里注册的是某个 Container Panel 对应的显示/隐藏等命令
   */
  protected registerContainerPanelRelatedCommand(componentInfo: ComponentRegistryInfo) {
    const disposables = new DisposableCollection();
    const containerId = componentInfo.options?.containerId!;
    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: 'container.show.' + containerId,
          label: formatLocalize('view.command.show', componentInfo.options?.title ?? containerId),
          labelLocalized: createFormatLocalizedStr('view.command.show', componentInfo.options?.title ?? containerId),
          category: 'View',
        },
        {
          execute: () => {
            this.updateCurrentContainerId(containerId);
          },
        },
      ),
    );
    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: 'container.hide.' + containerId,
        },
        {
          execute: () => {
            this.updateCurrentContainerId('');
          },
        },
      ),
    );
    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: 'container.toggle.' + containerId,
        },
        {
          execute: () => {
            if (this.currentContainerId.get() === containerId) {
              this.updateCurrentContainerId('');
            } else {
              this.updateCurrentContainerId(containerId);
            }
          },
        },
      ),
    );
    return disposables;
  }

  protected registerHideMenu(componentInfo: ComponentRegistryInfo) {
    const disposables = new DisposableCollection();
    const containerId = componentInfo.options!.containerId;

    disposables.push(
      this.menuRegistry.registerMenuItem(this.menuId, {
        command: {
          id: this.registerVisibleToggleCommand(containerId, disposables),
          label: componentInfo.options!.title || containerId,
        },
        group: '1_widgets',
      }),
    );

    return disposables;
  }

  protected registerMoreMenu(componentInfo: ComponentRegistryInfo) {
    const disposables = new DisposableCollection();
    const containerId = componentInfo.options!.containerId;
    const tabInMoreKey = this.scopedCtxKeyService.createKey(this.getTabInMoreCtxKey(containerId), false);
    this.tabInMoreKeyMap.set(containerId, tabInMoreKey);
    disposables.push({
      dispose: () => this.tabInMoreKeyMap.delete(containerId),
    });
    disposables.push(
      this.menuRegistry.registerMenuItem(this.moreMenuId, {
        command: {
          id: this.registerMoreToggleCommand(componentInfo, disposables),
          label: componentInfo.options!.title || containerId,
        },
        group: 'inline',
        when: `${this.getTabInMoreCtxKey(containerId)} == true`,
        toggledWhen: `${getTabbarCtxKey(this.location)} == ${containerId}`,
        iconClass: componentInfo.options!.iconClass,
      }),
    );
    return disposables;
  }

  disposeContainer(containerId: string) {
    const disposables = this.disposableMap.get(containerId);
    if (disposables) {
      disposables.dispose();
    }
    if (this.currentContainerId.get() === containerId) {
      this.updateCurrentContainerId(this.visibleContainers[0].options?.containerId || '');
    }
  }

  updateTitle(containerId: string, title: string) {
    const container = this.getContainer(containerId);
    if (container) {
      container.options!.title = title;
    }
  }

  getContainer(containerId: string | undefined) {
    return containerId ? this.containersMap.get(containerId) : undefined;
  }

  // 针对 containerId 对 menu 进行缓存
  private _menuMap = new Map<string, IMenu>();

  public getTitleToolbarMenu(containerId: string) {
    const existedMenu = this._menuMap.get(containerId);
    if (existedMenu) {
      return existedMenu;
    }

    const menu = this.menuService.createMenu(
      MenuId.ViewTitle,
      this.viewContextKeyRegistry.getContextKeyService(containerId),
    );
    this._menuMap.set(containerId, menu);

    // 添加到 containerId 对应的 disposable 中
    // 在 containerId 对应的 view dispose 时会将 menu 对象和缓存清理掉
    const disposables = this.disposableMap.get(containerId);
    const toDispose = [
      menu,
      toDisposable(() => {
        this._menuMap.delete(containerId);
      }),
    ];

    if (disposables) {
      disposables.pushAll(toDispose);
    } else {
      // 避免出现不必要的内存泄露
      this.addDispose(toDispose);
    }

    return menu;
  }

  doExpand(expand: boolean) {
    if (this.resizeHandle) {
      const { setRelativeSize } = this.resizeHandle;
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
  }

  get isExpanded(): boolean {
    if (this.resizeHandle) {
      const { getRelativeSize } = this.resizeHandle;
      const relativeSizes = getRelativeSize().join(',');
      return this.isLatter ? relativeSizes === '0,1' : relativeSizes === '1,0';
    }
    return false;
  }

  handleTabClick(e: React.MouseEvent, forbidCollapse?: boolean) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId.get() && !forbidCollapse) {
      // 双击同一个 tab 时隐藏 panel
      this.updateCurrentContainerId('');
    } else {
      this.updateCurrentContainerId(containerId);
    }
  }

  handleContextMenu(event: React.MouseEvent, containerId?: string) {
    event.preventDefault();
    event.stopPropagation();
    const menus = this.menuService.createMenu(
      this.menuId,
      containerId ? this.scopedCtxKeyService : this.contextKeyService,
    );
    const menuNodes = generateCtxMenu({ menus, args: [{ containerId }] });
    this.contextMenuRenderer.show({
      menuNodes: menuNodes[1],
      anchor: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  }

  showMoreMenu(event: React.MouseEvent, lastContainerId?: string) {
    const menus = this.menuService.createMenu(this.moreMenuId, this.scopedCtxKeyService);
    const menuNodes = generateCtxMenu({ menus, args: [{ lastContainerId }] });
    this.contextMenuRenderer.show({
      menuNodes: menuNodes[1],
      anchor: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  }

  // drag & drop
  handleDragStart(e: React.DragEvent, containerId: string) {
    e.dataTransfer.setData('containerId', containerId);
    this.layoutService.showDropAreaForContainer(containerId);
  }

  handleDrop(e: React.DragEvent, target: string) {
    if (e.dataTransfer.getData('containerId')) {
      const source = e.dataTransfer.getData('containerId');
      const containers = this.visibleContainers;
      const sourceIndex = containers.findIndex((containerInfo) => source === containerInfo.options!.containerId);
      const targetIndex = containers.findIndex((containerInfo) => target === containerInfo.options!.containerId);
      this.doInsertTab(containers, sourceIndex, targetIndex);
      this.storeState();
    }
  }

  handleDragEnd(e: React.DragEvent) {
    this.layoutService.hideDropArea();
  }

  restoreState() {
    this.storedState = this.layoutState.getState(LAYOUT_STATE.getTabbarSpace(this.location), {});
    for (const containerId of this.state.keys()) {
      if (this.storedState[containerId]) {
        this.state.set(containerId, this.storedState[containerId]);
      }
    }
    this.visibleContainers.forEach((container) => {
      if (SUPPORT_ACCORDION_LOCATION.has(this.location)) {
        this.tryRestoreAccordionSize(container.options!.containerId);
      }
    });
  }

  removeContainer(containerId: string) {
    const disposable = this.disposableMap.get(containerId);
    disposable?.dispose();
    this.updateCurrentContainerId('');
    this.doChangeViewEmitter.fire();
  }

  dynamicAddContainer(containerId: string, options: ComponentRegistryInfo) {
    this.registerContainer(containerId, options);
    this.updateCurrentContainerId(containerId);
    this.doChangeViewEmitter.fire();
  }

  protected doInsertTab(containers: ComponentRegistryInfo[], sourceIndex: number, targetIndex: number) {
    const targetPriority = this.getContainerState(containers[targetIndex].options!.containerId).priority;
    const changePriority = (sourceIndex: number, targetIndex: number) => {
      const sourceState = this.getContainerState(containers[sourceIndex].options!.containerId);
      const targetState = this.getContainerState(containers[targetIndex].options!.containerId);
      sourceState.priority = targetState.priority;
    };
    let index: number;
    if (sourceIndex > targetIndex) {
      // 后往前拖，中间的tab依次下移
      for (index = targetIndex; index < sourceIndex; index++) {
        changePriority(index, index + 1);
      }
    } else {
      // 前往后拖，中间的上移
      for (index = targetIndex; index > sourceIndex; index--) {
        changePriority(index, index - 1);
      }
    }
    this.getContainerState(containers[index].options!.containerId).priority = targetPriority;
    this.doChangeViewEmitter.fire();
  }

  protected storeState() {
    const stateObj = {};
    this.state.forEach((value, key) => {
      stateObj[key] = value;
    });
    this.layoutState.setState(LAYOUT_STATE.getTabbarSpace(this.location), stateObj);
  }

  // 注册Tab的激活快捷键，对于底部panel，为切换快捷键
  private registerActivateKeyBinding(component: ComponentRegistryInfo, fromExtension?: boolean) {
    const options = component.options!;
    const containerId = options.containerId;
    // vscode内插件注册的是workbench.view.extension.containerId
    const activateCommandId = fromExtension
      ? `workbench.view.extension.${containerId}`
      : `workbench.view.${containerId}`;
    const disposables = new DisposableCollection();
    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: activateCommandId,
        },
        {
          execute: ({ forceShow }: { forceShow?: boolean } = {}) => {
            // 支持toggle
            if (this.location === 'bottom' && !forceShow) {
              this.updateCurrentContainerId(this.currentContainerId.get() === containerId ? '' : containerId);
            } else {
              this.updateCurrentContainerId(containerId);
            }
          },
        },
      ),
    );
    if (options.activateKeyBinding) {
      disposables.push(
        this.keybindingRegistry.registerKeybinding({
          command: activateCommandId,
          keybinding: options.activateKeyBinding!,
        }),
      );
    }
    return disposables;
  }

  private registerGlobalToggleCommand() {
    const commandId = `activity.bar.toggle.${this.location}`;
    this.commandRegistry.registerCommand(
      {
        id: commandId,
      },
      {
        execute: ({ containerId }: { containerId: string }) => {
          this.doToggleTab(containerId);
        },
        isEnabled: () => this.visibleContainers.length > 1,
      },
    );
    return commandId;
  }

  // 注册当前 container 在 tabBar 上的隐藏显示功能
  private registerVisibleToggleCommand(containerId: string, disposables: DisposableCollection): string {
    const commandId = `activity.bar.toggle.${containerId}`;
    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: commandId,
        },
        {
          execute: ({ forceShow }: { forceShow?: boolean } = {}) => {
            this.doToggleTab(containerId, forceShow);
          },
          isToggled: () => {
            const state = this.getContainerState(containerId);
            return !state.hidden;
          },
          isEnabled: () => {
            const state = this.getContainerState(containerId);
            return state.hidden || this.visibleContainers.length !== 1;
          },
        },
      ),
    );
    return commandId;
  }

  private registerMoreToggleCommand(component: ComponentRegistryInfo, disposables: DisposableCollection): string {
    const { options } = component;
    const { containerId } = options!;
    const commandId = `activity.bar.activate.more.${containerId}`;
    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: commandId,
        },
        {
          execute: ({ lastContainerId }: { lastContainerId?: string }) => {
            // 切换激活tab
            this.updateCurrentContainerId(containerId);
            if (lastContainerId) {
              // 替换最后一个可见tab
              const sourceState = this.getContainerState(containerId);
              const targetState = this.getContainerState(lastContainerId);
              const sourcePriority = sourceState.priority;
              sourceState.priority = targetState.priority;
              targetState.priority = sourcePriority;
              this.storeState();
            }
          },
        },
      ),
    );
    return commandId;
  }

  private getTabInMoreCtxKey(containerId: string) {
    return `${containerId}.isInMore`;
  }

  protected registerPanelMenus() {
    this.menuRegistry.registerMenuItems(getTabbarCommonMenuId('bottom'), [
      {
        command: EXPAND_BOTTOM_PANEL.id,
        group: 'navigation',
        when: '!bottomFullExpanded',
        order: 1,
      },
      {
        command: RETRACT_BOTTOM_PANEL.id,
        group: 'navigation',
        when: 'bottomFullExpanded',
        order: 1,
      },
      {
        command: TOGGLE_BOTTOM_PANEL_COMMAND.id,
        group: 'navigation',
        order: 2,
      },
    ]);
    this.commonTitleMenu = this.ctxMenuService.createMenu({
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

    if (state.hidden && this.currentContainerId.get() === containerId) {
      // 如果隐藏的是当前激活的 tab，则激活第一个可见 tab
      this.updateCurrentContainerId(this.visibleContainers[0].options!.containerId);
    }
    this.storeState();
  }

  protected shouldExpand(containerId: string | undefined) {
    const info = this.getContainer(containerId);
    return info && info.options && info.options.expanded;
  }

  protected onResize() {
    fastdom.measureAtNextFrame(() => {
      if (!this.currentContainerId || !this.resizeHandle) {
        // 折叠时不监听变化
        return;
      }

      const size = this.resizeHandle.getSize();
      if (size !== this.barSize && !this.shouldExpand(this.currentContainerId.get())) {
        this.prevSize = size;
        this.onSizeChangeEmitter.fire({ size });
      }
    });
  }

  protected listenCurrentChange() {
    return autorunDelta(this.currentContainerId, ({ lastValue, newValue }) => {
      this.previousContainerId = lastValue === NONE_CONTAINER_ID ? '' : lastValue;
      this.handleChange(newValue, lastValue);
    });
  }

  private handleChange(currentId, previousId) {
    // 这里的 handleChange 是会在 registerResizeHandle 后才会执行
    if (!this.resizeHandle) {
      return;
    }
    const { getSize, setSize, lockSize } = this.resizeHandle;
    this.onCurrentChangeEmitter.fire({ previousId, currentId });
    const isCurrentExpanded = this.shouldExpand(currentId);
    if (this.shouldExpand(this.previousContainerId) || isCurrentExpanded) {
      this.handleFullExpanded(currentId, isCurrentExpanded);
    } else {
      if (currentId) {
        if (previousId && currentId !== previousId) {
          this.prevSize = getSize();
        }
        const containerInfo = this.getContainer(currentId);

        setSize(this.prevSize || this.panelSize + this.barSize);
        lockSize(Boolean(containerInfo?.options?.noResize));

        this.activatedKey.set(currentId);
      } else {
        setSize(this.barSize);
        lockSize(true);
      }
    }
  }

  protected tryRestoreAccordionSize(containerId: string) {
    if (this.accordionRestored.has(containerId)) {
      return;
    }
    const containerInfo = this.containersMap.get(containerId);
    // 使用自定义视图取代手风琴的面板不需要 restore
    // scm 视图例外，因为在新版本 Gitlens 中可以将自己注册到 scm 中
    // 暂时用这种方式使 scm 面板状态可以被持久化
    if (
      (!containerInfo || containerInfo.options?.component) &&
      containerInfo?.options?.containerId !== SCM_CONTAINER_ID
    ) {
      return;
    }
    const accordionService = this.layoutService.getAccordionService(containerId);
    // 需要保证此时tab切换已完成dom渲染
    accordionService.restoreState();
    this.accordionRestored.add(containerId);
  }

  protected handleFullExpanded(currentId: string, isCurrentExpanded?: boolean) {
    if (!this.resizeHandle) {
      return;
    }
    const { setRelativeSize, setSize } = this.resizeHandle;
    if (currentId) {
      if (isCurrentExpanded) {
        if (!this.isLatter) {
          setRelativeSize(1, 0);
        } else {
          setRelativeSize(0, 1);
        }
      } else {
        setSize(this.prevSize || this.panelSize + this.barSize);
      }
    } else {
      setSize(this.barSize);
    }
  }
}
