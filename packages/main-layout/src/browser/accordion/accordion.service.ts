import { debounce } from 'lodash';
import { action, observable } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import {
  View,
  CommandRegistry,
  ViewContextKeyRegistry,
  IContextKeyService,
  localize,
  IContextKey,
  OnEvent,
  WithEventBus,
  ResizeEvent,
  DisposableCollection,
  ContextKeyChangeEvent,
  Event,
  Emitter,
  IScopedContextKeyService,
} from '@opensumi/ide-core-browser';
import { RESIZE_LOCK } from '@opensumi/ide-core-browser/lib/components';
import {
  SplitPanelManager,
  SplitPanelService,
} from '@opensumi/ide-core-browser/lib/components/layout/split-panel.service';
import { LayoutState, LAYOUT_STATE } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import {
  AbstractContextMenuService,
  AbstractMenuService,
  IMenu,
  IMenuRegistry,
  ICtxMenuRenderer,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';

import { ViewCollapseChangedEvent } from '../../common';


export interface SectionState {
  collapsed: boolean;
  hidden: boolean;
  size?: number;
  nextSize?: number;
}

@Injectable({ multiple: true })
export class AccordionService extends WithEventBus {
  @Autowired()
  protected splitPanelManager: SplitPanelManager;

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  protected ctxMenuService: AbstractContextMenuService;

  @Autowired(IMenuRegistry)
  protected menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(IProgressService)
  private progressService: IProgressService;

  protected splitPanelService: SplitPanelService;

  // 用于强制显示功能的contextKey
  private forceRevealContextKeys = new Map<string, { when: string; key: IContextKey<boolean> }>();
  // 所有View的when条件集合
  private viewWhenContextkeys = new Set<string>();
  // 带contextKey且已渲染的视图
  private appendedViewSet = new Set<string>();
  // 所有带contextKey视图
  private viewsWithContextKey = new Set<View>();

  @observable.shallow views: View[] = [];

  @observable state: { [viewId: string]: SectionState } = {};
  // 提供给Mobx强刷，有没有更好的办法？
  @observable forceUpdate = 0;

  rendered = false;

  private headerSize: number;
  private minSize: number;
  private menuId = `accordion/${this.containerId}`;
  private toDispose: Map<string, DisposableCollection> = new Map();

  private topViewKey: IContextKey<string>;
  private scopedCtxKeyService: IScopedContextKeyService;

  private beforeAppendViewEmitter = new Emitter<string>();
  public onBeforeAppendViewEvent = this.beforeAppendViewEmitter.event;

  private afterAppendViewEmitter = new Emitter<string>();
  public onAfterAppendViewEvent = this.afterAppendViewEmitter.event;

  private afterDisposeViewEmitter = new Emitter<string>();
  public onAfterDisposeViewEvent = this.afterDisposeViewEmitter.event;

  constructor(public containerId: string, private noRestore?: boolean) {
    super();
    this.splitPanelService = this.splitPanelManager.getService(containerId);
    this.scopedCtxKeyService = this.contextKeyService.createScoped();
    this.scopedCtxKeyService.createKey('triggerWithSection', true);
    this.menuRegistry.registerMenuItem(this.menuId, {
      command: {
        id: this.registerGlobalToggleCommand(),
        label: localize('layout.view.hide', '隐藏'),
      },
      group: '0_global',
      when: 'triggerWithSection == true',
    });
    this.viewContextKeyRegistry.afterContextKeyServiceRegistered(this.containerId, (contextKeyService) => {
      this.topViewKey = contextKeyService!.createKey('view', containerId);
      setTimeout(() => {
        // 由于tabbar.service会立刻设置view，这边要等下一个event loop
        this.popViewKeyIfOnlyOneViewVisible();
      });
    });
    this.addDispose(
      Event.debounce<ContextKeyChangeEvent, boolean>(
        this.contextKeyService.onDidChangeContext,
        (last, event) => last || event.payload.affectsSome(this.viewWhenContextkeys),
        50,
      )((e) => e && this.handleContextKeyChange(), this),
    );
    this.listenWindowResize();
  }

  tryUpdateResize() {
    this.doUpdateResize();
  }

  restoreState() {
    if (this.noRestore) {
      return;
    }
    const defaultState: { [containerId: string]: SectionState } = {};
    this.visibleViews.forEach((view) => (defaultState[view.id] = { collapsed: false, hidden: false }));
    const restoredState = this.layoutState.getState(LAYOUT_STATE.getContainerSpace(this.containerId), defaultState);
    if (restoredState !== defaultState) {
      this.state = restoredState;
    }
    this.popViewKeyIfOnlyOneViewVisible();
    this.restoreSize();
    this.rendered = true;
  }

  // 调用时需要保证dom可见
  restoreSize() {
    // 计算存储总高度与当前窗口总高度差，加到最后一个展开的面板
    let availableSize = this.splitPanelService.rootNode?.clientHeight || 0;
    let finalUncollapsedIndex: number | undefined;
    this.visibleViews.forEach((view, index) => {
      const savedState = this.state[view.id];
      if (savedState.collapsed) {
        this.setSize(index, 0, false, true);
        availableSize -= this.headerSize;
      } else if (!savedState.collapsed && savedState.size) {
        this.setSize(index, savedState.size, false, true);
        availableSize -= savedState.size;
        finalUncollapsedIndex = index;
      }
    });
    if (finalUncollapsedIndex) {
      this.setSize(
        finalUncollapsedIndex,
        this.state[this.visibleViews[finalUncollapsedIndex].id].size! + availableSize,
      );
    }
  }

  initConfig(config: { headerSize: number; minSize: number }) {
    const { headerSize, minSize } = config;
    this.headerSize = headerSize;
    this.minSize = minSize;
  }

  private registerContextService(viewId: string) {
    let scopedCtxKey = this.viewContextKeyRegistry.getContextKeyService(viewId);
    if (!scopedCtxKey) {
      scopedCtxKey = this.contextKeyService.createScoped();
      scopedCtxKey.createKey('view', viewId);
      this.viewContextKeyRegistry.registerContextKeyService(viewId, scopedCtxKey);
    }
    return scopedCtxKey;
  }

  getSectionToolbarMenu(viewId: string): IMenu {
    // 确保在较早获取菜单时已经注册了 ScopedContextKeyService
    const scopedCtxKey = this.registerContextService(viewId);
    const menu = this.menuService.createMenu(MenuId.ViewTitle, scopedCtxKey);
    const existingView = this.views.find((view) => view.id === viewId);
    if (existingView) {
      existingView.titleMenu = menu;
    }
    return menu;
  }

  appendView(view: View, replace?: boolean) {
    if (this.appendedViewSet.has(view.id) && !replace) {
      return;
    }
    const disposables = new DisposableCollection();
    disposables.push(this.progressService.registerProgressIndicator(view.id));
    // 已存在的viewId直接替换
    const existIndex = this.views.findIndex((item) => item.id === view.id);
    if (existIndex !== -1) {
      this.views[existIndex] = Object.assign({}, this.views[existIndex], view);
      return;
    }
    // 带contextKey视图需要先判断下
    if (view.when) {
      this.viewsWithContextKey.add(view);
      // 强制显示的contextKey
      const forceRevealExpr = this.createRevealContextKey(view.id);
      this.fillKeysInWhenExpr(this.viewWhenContextkeys, view.when);
      // 如果不匹配则跳过
      if (!this.contextKeyService.match(view.when) && !this.contextKeyService.match(forceRevealExpr)) {
        return;
      }
      this.appendedViewSet.add(view.id);
    }
    this.beforeAppendViewEmitter.fire(view.id);
    const index = this.views.findIndex((value) => (value.priority || 0) < (view.priority || 0));
    this.views.splice(index === -1 ? this.views.length : index, 0, view);

    // 创建 scopedContextKeyService
    this.registerContextService(view.id);

    disposables.push(
      this.menuRegistry.registerMenuItem(this.menuId, {
        command: {
          id: this.registerVisibleToggleCommand(view.id, disposables),
          label: view.name || view.id,
        },
        group: '1_widgets',
        // TODO order计算
      }),
    );
    this.toDispose.set(view.id, disposables);
    this.popViewKeyIfOnlyOneViewVisible();
    this.afterAppendViewEmitter.fire(view.id);
  }

  disposeView(viewId: string) {
    const existIndex = this.views.findIndex((item) => item.id === viewId);
    if (existIndex > -1) {
      this.views.splice(existIndex, 1);
    }
    const disposable = this.toDispose.get(viewId);
    if (disposable) {
      disposable.dispose();
    }
    this.appendedViewSet.delete(viewId);
    this.popViewKeyIfOnlyOneViewVisible();
    this.afterDisposeViewEmitter.fire(viewId);
  }

  revealView(viewId: string) {
    const target = this.forceRevealContextKeys.get(viewId);
    if (target) {
      target.key.set(true);
    }
  }

  disposeAll() {
    this.views = [];
    this.toDispose.forEach((disposable) => {
      disposable.dispose();
    });
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    // 监听来自resize组件的事件
    if (e.payload.slotLocation) {
      if (this.state[e.payload.slotLocation]) {
        const id = e.payload.slotLocation;
        // get dom of viewId
        const sectionDom = document.getElementById(id);
        if (sectionDom) {
          this.state[id].size = sectionDom.clientHeight;
          this.storeState();
        }
      }
    }
  }

  private doUpdateResize = debounce(() => {
    let largestViewId: string | undefined;
    Object.keys(this.state).forEach((id) => {
      if (!(this.state[id].hidden || this.state[id].collapsed)) {
        if (!largestViewId) {
          largestViewId = id;
        } else {
          if ((this.state[id].size || 0) > (this.state[largestViewId].size || 0)) {
            largestViewId = id;
          }
        }
      }
    });
    if (largestViewId && this.splitPanelService.isVisible && this.expandedViews.length > 1) {
      // 需要过滤掉没有实际注册的视图
      const diffSize = this.splitPanelService.rootNode!.clientHeight - this.getPanelFullHeight();
      if (diffSize) {
        this.state[largestViewId].size! += diffSize;
        this.toggleOpen(largestViewId!, false);
      }
    }
  }, 16);

  private getPanelFullHeight(ignoreViewId?: string) {
    return Object.keys(this.state)
      .filter((viewId) => this.views.find((item) => item.id === viewId) && viewId !== ignoreViewId)
      .reduce(
        (acc, id) =>
          acc + (this.state[id].collapsed ? this.headerSize : this.state[id].hidden ? 0 : this.state[id].size!),
        0,
      );
  }

  protected listenWindowResize() {
    window.addEventListener('resize', this.doUpdateResize);
    this.addDispose({ dispose: () => window.removeEventListener('resize', this.doUpdateResize) });
  }

  private createRevealContextKey(viewId: string) {
    const forceRevealKey = `forceShow.${viewId}`;
    this.forceRevealContextKeys.set(viewId, {
      when: `${forceRevealKey} == true`,
      key: this.contextKeyService.createKey(forceRevealKey, false),
    });
    this.viewWhenContextkeys.add(forceRevealKey);
    return `${forceRevealKey} == true`;
  }

  protected storeState = debounce(() => {
    if (this.noRestore || !this.rendered) {
      return;
    }
    this.layoutState.setState(LAYOUT_STATE.getContainerSpace(this.containerId), this.state);
  }, 200);

  private registerGlobalToggleCommand() {
    const commandId = `view-container.hide.${this.containerId}`;
    this.commandRegistry.registerCommand(
      {
        id: commandId,
      },
      {
        execute: ({ viewId }: { viewId: string }) => {
          this.doToggleView(viewId);
        },
        isEnabled: () => this.visibleViews.length > 1,
      },
    );
    return commandId;
  }

  private registerVisibleToggleCommand(viewId: string, disposables: DisposableCollection): string {
    const commandId = `view-container.hide.${viewId}`;

    disposables.push(
      this.commandRegistry.registerCommand(
        {
          id: commandId,
        },
        {
          execute: ({ forceShow }: { forceShow?: boolean } = {}) => {
            this.doToggleView(viewId, forceShow);
          },
          isToggled: () => {
            const state = this.getViewState(viewId);
            return !state.hidden;
          },
          isEnabled: () => {
            const state = this.getViewState(viewId);
            return state.hidden || this.visibleViews.length > 1;
          },
        },
      ),
    );

    return commandId;
  }

  protected doToggleView(viewId: string, forceShow?: boolean) {
    const state = this.getViewState(viewId);
    let nextState: boolean;
    if (forceShow === undefined) {
      nextState = !state.hidden;
    } else {
      nextState = !forceShow;
    }
    state.hidden = nextState;
    this.popViewKeyIfOnlyOneViewVisible();
    this.storeState();
  }

  popViewKeyIfOnlyOneViewVisible() {
    if (!this.topViewKey) {
      // 可能还没初始化
      return;
    }
    const visibleViews = this.visibleViews;
    if (visibleViews.length === 1) {
      this.topViewKey.set(visibleViews[0].id);
    } else {
      this.topViewKey.reset();
    }
  }

  toggleViewVisibility(viewId: string, show?: boolean) {
    this.doToggleView(viewId, show);
  }

  get visibleViews(): View[] {
    return this.views.filter((view) => {
      const viewState = this.getViewState(view.id);
      return !viewState.hidden;
    });
  }

  get expandedViews(): View[] {
    return this.views.filter((view) => {
      const viewState = this.state[view.id];
      return !viewState || (viewState && !viewState.hidden && !viewState.collapsed);
    });
  }

  @action toggleOpen(viewId: string, collapsed: boolean) {
    const index = this.visibleViews.findIndex((view) => view.id === viewId);
    if (index > -1) {
      this.doToggleOpen(viewId, collapsed, index, true);
    }
  }

  @action.bound handleSectionClick(viewId: string, collapsed: boolean, index: number) {
    this.doToggleOpen(viewId, collapsed, index);
  }

  @action.bound handleContextMenu(event: React.MouseEvent, viewId?: string) {
    event.preventDefault();
    const menus = this.ctxMenuService.createMenu({
      id: this.menuId,
      config: { args: [{ viewId }] },
      contextKeyService: viewId ? this.viewContextKeyRegistry.getContextKeyService(viewId) : undefined,
    });
    const menuNodes = menus.getGroupedMenuNodes();
    menus.dispose();
    this.contextMenuRenderer.show({
      menuNodes: menuNodes[1],
      anchor: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  }

  public getViewState(viewId: string) {
    let viewState = this.state[viewId];
    const view = this.views.find((item) => item.id === viewId);
    if (!viewState) {
      this.state[viewId] = { collapsed: view?.collapsed || false, hidden: view?.hidden || false };
      viewState = this.state[viewId]!;
    }
    return viewState;
  }

  protected doToggleOpen(viewId: string, collapsed: boolean, index: number, noAnimation?: boolean) {
    const viewState = this.getViewState(viewId);
    viewState.collapsed = collapsed;
    let sizeIncrement: number;
    if (collapsed) {
      sizeIncrement = this.setSize(index, 0, false, noAnimation);
    } else {
      // 仅有一个视图展开时独占
      sizeIncrement = this.setSize(
        index,
        this.expandedViews.length === 1 ? this.getAvailableSize() : viewState.size || this.minSize,
        false,
        noAnimation,
      );
    }
    // 下方视图被影响的情况下，上方视图不会同时变化，该情况会在sizeIncrement=0上体现
    // 从视图下方最后一个展开的视图起依次减去对应的高度
    for (let i = this.visibleViews.length - 1; i > index; i--) {
      if (this.getViewState(this.visibleViews[i].id).collapsed !== true) {
        sizeIncrement = this.setSize(i, sizeIncrement, true, noAnimation);
      } else {
        this.setSize(i, 0, false, noAnimation);
      }
    }
    // 找到视图上方首个展开的视图减去对应的高度
    for (let i = index - 1; i >= 0; i--) {
      if ((this.state[this.visibleViews[i].id] || {}).collapsed !== true) {
        sizeIncrement = this.setSize(i, sizeIncrement, true, noAnimation);
      } else {
        this.setSize(i, 0, false, noAnimation);
      }
    }

    this.eventBus.fire(
      new ViewCollapseChangedEvent({
        viewId,
        collapsed: viewState.collapsed,
      }),
    );
  }

  protected setSize(index: number, targetSize: number, isIncrement?: boolean, noAnimation?: boolean): number {
    const fullHeight = this.splitPanelService.rootNode!.clientHeight;
    const panel = this.splitPanelService.panels[index];
    if (!noAnimation) {
      panel.classList.add('resize-ease');
    }
    if (!targetSize && !isIncrement) {
      targetSize = this.headerSize;
      panel.classList.add(RESIZE_LOCK);
    } else {
      panel.classList.remove(RESIZE_LOCK);
    }
    // clientHeight会被上次展开的元素挤掉
    const prevSize = panel.clientHeight;
    const viewState = this.getViewState(this.visibleViews[index].id);
    let calcTargetSize: number = targetSize;
    // 视图即将折叠时、受其他视图影响尺寸变化时、主动展开时、resize时均需要存储尺寸信息
    if (isIncrement) {
      calcTargetSize = Math.max(prevSize - targetSize, this.minSize);
    }
    if (index === this.expandedViews.length - 1) {
      // 最后一个视图需要兼容最大高度超出总视图高度及最大高度不足总视图高度的情况
      if (calcTargetSize + index * this.minSize > fullHeight) {
        calcTargetSize -= calcTargetSize + index * this.minSize - fullHeight;
      } else {
        const restSize = this.getPanelFullHeight(this.visibleViews[index].id);
        if (calcTargetSize + restSize < fullHeight) {
          calcTargetSize += fullHeight - (calcTargetSize + restSize);
        }
      }
    }
    if (this.rendered) {
      let toSaveSize: number;
      if (targetSize === this.headerSize) {
        // 当前视图即将折叠且不是唯一展开的视图时，存储当前高度
        toSaveSize = prevSize;
      } else {
        toSaveSize = calcTargetSize;
      }
      if (toSaveSize !== this.headerSize) {
        // 视图折叠高度不做存储
        viewState.size = toSaveSize;
      }
    }
    this.storeState();
    viewState.nextSize = calcTargetSize;
    if (!noAnimation) {
      setTimeout(() => {
        // 动画 0.1s，保证结束后移除
        panel.classList.remove('resize-ease');
      }, 200);
    }
    return isIncrement ? calcTargetSize - (prevSize - targetSize) : targetSize - prevSize;
  }

  protected getAvailableSize() {
    const fullHeight = this.splitPanelService.rootNode!.clientHeight;
    return fullHeight - (this.visibleViews.length - 1) * this.headerSize;
  }

  private handleContextKeyChange() {
    Array.from(this.viewsWithContextKey.values()).forEach((view) => {
      if (
        this.contextKeyService.match(view.when) ||
        this.contextKeyService.match(this.forceRevealContextKeys.get(view.id)!.when)
      ) {
        this.appendView(view);
      } else {
        this.disposeView(view.id);
      }
    });
  }

  private fillKeysInWhenExpr(set: Set<string>, when?: string) {
    const keys = this.contextKeyService.getKeysInWhen(when);
    keys.forEach((key) => {
      set.add(key);
    });
  }
}

export const AccordionServiceFactory = Symbol('AccordionServiceFactory');
