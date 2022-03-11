import debounce = require('lodash.debounce');
import { observable, action, observe, computed } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import {
  toDisposable,
  WithEventBus,
  ComponentRegistryInfo,
  Emitter,
  Event,
  OnEvent,
  ResizeEvent,
  SlotLocation,
  CommandRegistry,
  localize,
  KeybindingRegistry,
  ViewContextKeyRegistry,
  IContextKeyService,
  getTabbarCtxKey,
  IContextKey,
  DisposableCollection,
  IScopedContextKeyService,
  Deferred,
} from '@opensumi/ide-core-browser';
import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { LayoutState, LAYOUT_STATE } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import {
  AbstractContextMenuService,
  AbstractMenuService,
  IContextMenu,
  IMenuRegistry,
  ICtxMenuRenderer,
  generateCtxMenu,
  IMenu,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';

import { TabBarRegistrationEvent, IMainLayoutService, SUPPORT_ACCORDION_LOCATION } from '../../common';
import { TOGGLE_BOTTOM_PANEL_COMMAND, EXPAND_BOTTOM_PANEL, RETRACT_BOTTOM_PANEL } from '../main-layout.contribution';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');
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

@Injectable({ multiple: true })
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  previousContainerId = '';

  // 由于 observable.map （即使是deep:false) 会把值转换成observableValue，不希望这样
  containersMap: Map<string, ComponentRegistryInfo> = new Map();
  @observable state: Map<string, TabState> = new Map();

  private storedState: { [containerId: string]: TabState } = {};

  public prevSize?: number;
  public commonTitleMenu: IContextMenu;

  public viewReady = new Deferred<void>();

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

  // 提供给Mobx强刷
  @observable forceUpdate = 0;

  private accordionRestored: Set<string> = new Set();

  private readonly onCurrentChangeEmitter = new Emitter<{ previousId: string; currentId: string }>();
  readonly onCurrentChange: Event<{ previousId: string; currentId: string }> = this.onCurrentChangeEmitter.event;

  private readonly onSizeChangeEmitter = new Emitter<{ size: number }>();
  readonly onSizeChange: Event<{ size: number }> = this.onSizeChangeEmitter.event;

  public barSize: number;
  public panelSize: number;
  private menuId = `tabbar/${this.location}`;
  private moreMenuId = `tabbar/${this.location}/more`;
  private isLatter = this.location === SlotLocation.right || this.location === SlotLocation.bottom;
  private activatedKey: IContextKey<string>;
  private sortedContainers: Array<ComponentRegistryInfo> = [];
  private disposableMap: Map<string, DisposableCollection> = new Map();
  private tabInMoreKeyMap: Map<string, IContextKey<boolean>> = new Map();

  private scopedCtxKeyService: IScopedContextKeyService;

  constructor(public location: string) {
    super();
    this.scopedCtxKeyService = this.contextKeyService.createScoped();
    this.scopedCtxKeyService.createKey('triggerWithTab', true);
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerGlobalToggleCommand(),
        label: localize('layout.tabbar.hide', '隐藏'),
      },
      group: '0_global',
      when: 'triggerWithTab == true',
    });
    this.activatedKey = this.contextKeyService.createKey(getTabbarCtxKey(this.location), '');
    if (this.location === 'bottom') {
      this.registerPanelMenus();
    }
  }

  public getContainerState(containerId: string) {
    const viewState = this.state.get(containerId);
    return viewState!;
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

  public updateTabInMoreKey(containerId: string, value: boolean) {
    const ctxKey = this.tabInMoreKeyMap.get(containerId);
    if (ctxKey) {
      ctxKey.set(value);
    }
  }

  @computed({ equals: visibleContainerEquals })
  get visibleContainers() {
    const components: ComponentRegistryInfo[] = [];
    this.containersMap.forEach((component) => {
      const state = this.state.get(component.options!.containerId);
      if (!state || !state.hidden) {
        components.push(component);
      }
    });
    // TODO 使用object来存state的话，初始containersMap为空，貌似就无法实现这个监听（无法引用到一个observable的属性）
    // tslint:disable-next-line:no-unused-variable
    const size = this.state.size; // 监听state长度
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
    this.listenCurrentChange();
  }

  @action
  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    if (this.containersMap.has(containerId)) {
      return;
    }
    const disposables = new DisposableCollection();
    let options = componentInfo.options;
    if (!options) {
      options = {
        containerId,
      };
      componentInfo.options = options;
    }
    this.containersMap.set(containerId, {
      views: componentInfo.views,
      options: observable.object(options, undefined, { deep: false }),
    });
    disposables.push({
      dispose: () => {
        this.containersMap.delete(containerId);
        this.state.delete(containerId);
      },
    });
    this.updatePanelVisibility(this.containersMap.size > 0);
    // 需要立刻设置state，lazy 逻辑会导致computed 的 visibleContainers 可能在计算时触发变更，抛出mobx invariant错误
    // 另外由于containersMap不是observable, 这边setState来触发visibaleContainers更新
    // 注册时直接根据priority排序，restoreState时恢复到记录的状态（对于集成侧在onDidStart之后注册的视图，不提供顺序状态恢复能力）
    let insertIndex = this.sortedContainers.findIndex(
      (item) => (item.options!.priority || 1) <= (componentInfo.options!.priority || 1),
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
    if (containerId === this.currentContainerId) {
      // 需要重新触发currentChange副作用
      this.handleChange(containerId, '');
    }
    this.viewContextKeyRegistry
      .registerContextKeyService(containerId, this.contextKeyService.createScoped())
      .createKey('view', containerId);
    this.disposableMap.set(containerId, disposables);
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
    const containerExistKey = this.contextKeyService.createKey(
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

  @action
  disposeContainer(containerId: string) {
    const disposables = this.disposableMap.get(containerId);
    if (disposables) {
      disposables.dispose();
    }
    if (this.currentContainerId === containerId) {
      this.currentContainerId = this.visibleContainers[0].options!.containerId;
    }
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
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
    const { setRelativeSize } = this.resizeHandle!;
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
    const { getRelativeSize } = this.resizeHandle!;
    const relativeSizes = getRelativeSize().join(',');
    return this.isLatter ? relativeSizes === '0,1' : relativeSizes === '1,0';
  }

  @action.bound handleTabClick(e: React.MouseEvent, forbidCollapse?: boolean) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId && !forbidCollapse) {
      // 双击同一个 tab 时隐藏 panel
      this.currentContainerId = '';
    } else {
      this.currentContainerId = containerId;
    }
  }

  @action.bound handleContextMenu(event: React.MouseEvent, containerId?: string) {
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
              this.currentContainerId = this.currentContainerId === containerId ? '' : containerId;
            } else {
              this.currentContainerId = containerId;
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

  // 注册tab的隐藏显示功能
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
            this.currentContainerId = containerId;
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
    this.menuRegistry.registerMenuItems('tabbar/bottom/common', [
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

    if (state.hidden && this.currentContainerId === containerId) {
      // 如果隐藏的是当前激活的 tab，则激活第一个可见 tab
      this.currentContainerId = this.visibleContainers[0].options!.containerId;
    }
    this.storeState();
  }

  protected shouldExpand(containerId: string) {
    const info = this.getContainer(containerId);
    return info && info.options && info.options.expanded;
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === this.location) {
      if (!this.currentContainerId || !this.resizeHandle) {
        // 折叠时不监听变化
        return;
      }
      const size = this.resizeHandle.getSize();
      if (size !== this.barSize && !this.shouldExpand(this.currentContainerId)) {
        this.prevSize = size;
        this.onSizeChangeEmitter.fire({ size });
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
    const { getSize, setSize, lockSize } = this.resizeHandle!;
    this.onCurrentChangeEmitter.fire({ previousId, currentId });
    const isCurrentExpanded = this.shouldExpand(currentId);
    if (this.shouldExpand(this.previousContainerId) || isCurrentExpanded) {
      this.handleFullExpanded(currentId, isCurrentExpanded);
    } else {
      if (currentId) {
        if (previousId && currentId !== previousId) {
          this.prevSize = getSize();
        }
        setSize(this.prevSize || this.panelSize + this.barSize);
        const containerInfo = this.getContainer(currentId);
        if (containerInfo && containerInfo.options!.noResize) {
          lockSize(true);
        } else {
          lockSize(false);
        }
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
    if ((!containerInfo || containerInfo.options!.component) && containerInfo?.options?.containerId !== 'scm') {
      return;
    }
    const accordionService = this.layoutService.getAccordionService(containerId);
    // 需要保证此时tab切换已完成dom渲染
    accordionService.restoreState();
    this.accordionRestored.add(containerId);
  }

  protected handleFullExpanded(currentId: string, isCurrentExpanded?: boolean) {
    const { setRelativeSize, setSize } = this.resizeHandle!;
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

function visibleContainerEquals(a: ComponentRegistryInfo[], b: ComponentRegistryInfo[]): boolean {
  if (a.length !== b.length) {
    return false;
  } else {
    let isEqual = true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        isEqual = false;
        break;
      }
    }
    return isEqual;
  }
}
