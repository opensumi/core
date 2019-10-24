import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig, IContextKeyService, WithEventBus, OnEvent, SlotLocation, Command, CommandRegistry, KeybindingRegistry, CommandService, StorageProvider, IStorage, LayoutProviderState, STORAGE_NAMESPACE, MaybeNull, MenuModelRegistry, localize, SETTINGS_MENU_PATH } from '@ali/ide-core-browser';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { ActivityBarHandler } from './activity-bar-handler';
import { ViewContainerOptions, View, ResizeEvent, ITabbarWidget, SideState, SideStateManager, RenderedEvent, measurePriority, Side, ViewContextKeyRegistry, findClosestPart } from '@ali/ide-core-browser/lib/layout';
import { BoxLayout, BoxPanel, Widget } from '@phosphor/widgets';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import { SIDE_MENU_PATH } from '../common';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ViewContainerWidget, BottomPanelWidget, ReactPanelWidget } from '@ali/ide-activity-panel/lib/browser';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';

interface PTabbarWidget {
  widget: ActivityBarWidget;
  containers: BoxPanel[];
  priorities: number[];
}

interface ContainerWrap {
  container: ViewContainerWidget | BottomPanelWidget | ReactPanelWidget;
  side: Side;
}

// ActivityBarService是单例的，对应的Phospher TabbarService是多例的
@Injectable()
export class ActivityBarService extends WithEventBus {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private tabbarWidgetMap: Map<string, PTabbarWidget> = new Map([
    ['left', {
      widget: this.injector.get(ActivityBarWidget, ['left']),
      priorities: [],
      containers: [],
    }],
    ['right', {
      widget: this.injector.get(ActivityBarWidget, ['right']),
      priorities: [],
      containers: [],
    }],
    ['bottom', {
      widget: this.injector.get(ActivityBarWidget, ['bottom']),
      priorities: [],
      containers: [],
    }],
  ]);

  private handlerMap: Map<string, ActivityBarHandler> = new Map();
  private viewToContainerMap: Map<string, string> = new Map();
  private containersMap: Map<string, ContainerWrap> = new Map();
  private tabbarState: SideStateManager;

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired()
  viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(KeybindingRegistry)
  keybindingRegistry: KeybindingRegistry;

  @Autowired()
  layoutState: LayoutState;

  @Autowired(MenuModelRegistry)
  menus: MenuModelRegistry;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  @OnEvent(RenderedEvent)
  protected onRender() {
    for (const containerWrap of this.containersMap.values()) {
      if (containerWrap.container instanceof ViewContainerWidget) {
        containerWrap.container.restoreState();
      }
    }
  }

  public getContainer(viewOrContainerId: string) {
    let containerWrap = this.containersMap.get(viewOrContainerId);
    if (containerWrap) {
      if (!(containerWrap.container instanceof ViewContainerWidget)) {
        console.warn('目标容器不是一个ViewsContainerWidget，部分能力可能缺失');
      }
    } else {
      viewOrContainerId = this.viewToContainerMap.get(viewOrContainerId) || '';
      if (viewOrContainerId) {
        containerWrap = this.containersMap.get(viewOrContainerId);
      }
    }
    if (containerWrap) {
      return containerWrap.container;
    }
    return;
  }

  // append一个viewContainer，支持传入初始化views
  append(options: ViewContainerOptions, side: Side, views?: View[], Fc?: React.FunctionComponent): string {
    const { iconClass, priority, containerId, title, initialProps, expanded } = options;
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      let panelContainer: ViewContainerWidget | BottomPanelWidget | ReactPanelWidget;
      const command = this.registerVisibleToggleCommand(containerId);
      if (!views || !views.length) {
        if (!Fc) {
          console.error('视图数据或自定义视图请至少传入一种！');
        }
        panelContainer = this.injector.get(ReactPanelWidget, [Fc!, containerId]);
        panelContainer.title.label = title || '';
        panelContainer.title.iconClass = `activity-icon ${iconClass}`;
        if (expanded === true) {
          panelContainer.addClass('expanded');
        }
        this.containersMap.set(containerId, {
          container: panelContainer,
          side,
        });
      } else if (side !== 'bottom') {
        panelContainer = this.injector.get(ViewContainerWidget, [containerId, views, side, command]);
        panelContainer.title.label = title || '';
        panelContainer.updateTitleLabel();
        // TODO 侧边栏面板expand状态回归
        if (expanded === true) {
          panelContainer.addClass('expanded');
        }
        this.containersMap.set(containerId, {
          container: panelContainer,
          side,
        });
        this.tabbarWidgetMap.get(side)!.containers.push(panelContainer);
        for (const view of views) {
          // 存储通过viewId获取ContainerId的MAP
          this.viewToContainerMap.set(view.id, containerId);
          if (view.component) {
            (panelContainer as ViewContainerWidget).appendView(view, initialProps);
          }
        }
        panelContainer.title.iconClass = `activity-icon ${iconClass}`;
      } else {
        panelContainer = this.injector.get(BottomPanelWidget, [containerId, views[0], command]) as BottomPanelWidget;

        this.containersMap.set(containerId, {
          container: panelContainer,
          side,
        });
        panelContainer.addClass('overflow-visible');
      }

      // 用于右键菜单显示
      panelContainer.title.label = title!;
      // dataset小写，会渲染到tab的li节点上
      panelContainer.title.dataset = {
        containerid: containerId,
      };
      const insertIndex = measurePriority(tabbarWidget.priorities, priority);
      const tabbar = tabbarWidget.widget;
      tabbar.addWidget(panelContainer, side, insertIndex);
      this.handlerMap.set(containerId!, this.injector.get(ActivityBarHandler, [containerId, panelContainer.title, tabbar, side]));
      this.registerActivateKeyBinding(containerId, options);
      return containerId!;
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
      return '';
    }
  }

  // 注册Tab的激活快捷键，对于底部panel，为切换快捷键
  private registerActivateKeyBinding(containerId: string, options: ViewContainerOptions) {
    if (!options.activateKeyBinding) {
      return;
    }
    const activateCommandId = `activity.panel.activate.${containerId}`;
    const handler =  this.getTabbarHandler(containerId);
    this.commandRegistry.registerCommand({
      id: activateCommandId,
    }, {
      execute: () => {
        handler!.activate();
      },
    });
    this.keybindingRegistry.registerKeybinding({
      command: activateCommandId,
      keybinding: options.activateKeyBinding,
    });
  }

  private registerGlobalToggleCommand(side: Side) {
    const commandId = `activity.bar.toggle.${side}`;
    this.commandRegistry.registerCommand({
      id: commandId,
    }, {
      execute: (anchor: {x: number, y: number}) => {
        const target = document.elementFromPoint(anchor.x, anchor.y);
        const targetTab = findClosestPart(target, '.p-TabBar-tab');
        if (targetTab) {
          const containerId = (targetTab as HTMLLIElement).dataset.containerid;
          if (containerId) {
            this.doToggleTab(containerId);
          }
        }
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
      execute: (forceShow?: boolean) => {
        this.doToggleTab(containerId, forceShow);
      },
      isToggled: () => {
        const { container } = this.containersMap.get(containerId)!;
        return !container.inVisible;
      },
    });
    return commandId;
  }

  protected doToggleTab(containerId: string, forceShow?: boolean) {
    const { container, side } = this.containersMap.get(containerId)!;
    const tabbar = this.tabbarWidgetMap.get(side)!.widget.tabBar;
    const prevState = container.inVisible;
    if (forceShow === true) {
      container.inVisible = true;
    } else if (forceShow === false) {
      container.inVisible = false;
    }
    if (container.inVisible) {
      container.inVisible = false;
      // container.setHidden(false);
      // tabbar.currentTitle = container.title;
      tabbar.update();
    } else {
      container.inVisible = true;
      container.setHidden(true);
      if (tabbar.currentTitle === container.title) {
        tabbar.currentTitle = tabbar.titles.find((title) => title !== tabbar.currentTitle && !(title.owner as any).inVisible)!;
      } else {
        tabbar.update();
      }
    }
    if (container.inVisible !== prevState) {
      const tab = this.tabbarState[side]!.tabbars.find((tab) => tab.containerId === container.containerId)!;
      if (!tab) {
        this.tabbarState[side]!.tabbars.push({
          containerId: container.containerId,
          hidden: false,
        });
      } else {
        tab.hidden = container.inVisible;
      }
      this.storeState(this.tabbarState);
    }
  }

  private storeState(state: SideStateManager) {
    this.tabbarState = state;
    this.layoutState.setState(LAYOUT_STATE.MAIN, this.tabbarState);
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    const side = e.payload.slotLocation;
    if (side === SlotLocation.left || side === SlotLocation.right) {
      this.updateSideContainers(side);
    }
  }

  updateSideContainers(side: string) {
    window.requestAnimationFrame(() => {
      for (const sideContainer of this.tabbarWidgetMap.get(side)!.containers) {
        sideContainer.update();
      }
    });
  }

  private listenCurrentChange() {
    for (const [side, pTabbar] of this.tabbarWidgetMap.entries()) {
      const tabbar = pTabbar.widget;
      tabbar.currentChanged.connect((tabbar, args) => {
        const { currentWidget, currentIndex } = args;
        this.tabbarState[side]!.currentIndex = currentIndex;
        this.storeState(this.tabbarState);
        if (currentWidget) {
          // @ts-ignore
          const containerId = currentWidget.containerId;
          const titleWidget = this.viewContainerRegistry.getTitleBar(containerId);
          // 自定义React视图需要自行管理titleBar更新
          if (titleWidget) {
            titleWidget.update();
          }
          this.updateViewContainerContext(containerId!);
        }
      });
    }
  }

  private updateViewContainerContext(containerId: string) {
    this.contextKeyService.createKey('viewContainer', containerId);
  }

  registerViewToContainerMap(map: any) {
    if (map) {
      for (const containerId of Object.keys(map)) {
        map[containerId].forEach((viewid) => {
          this.viewToContainerMap.set(viewid, containerId);
        });
      }
    }
  }

  getTabbarWidget = (side: Side): PTabbarWidget => {
    return this.tabbarWidgetMap.get(side)!;
  }

  getTabbarHandler(viewOrContainerId: string): ActivityBarHandler {
    let activityHandler = this.handlerMap.get(viewOrContainerId);
    if (!activityHandler) {
      const containerId = this.viewToContainerMap.get(viewOrContainerId);
      if (containerId) {
        activityHandler = this.handlerMap.get(containerId);
      }
    }
    return activityHandler!;
  }

  refresh(stateManager: SideStateManager) {
    this.tabbarState = stateManager;
    for (const side of ['left', 'right', 'bottom']) {
      const tabbarWidget = this.tabbarWidgetMap.get(side)!;
      for (const tab of this.tabbarState[side]!.tabbars) {
        // 后置注册的状态忽略
        if (tab.hidden && this.containersMap.get(tab.containerId)) {
          this.commandService.executeCommand(`activity.bar.toggle.${tab.containerId}`);
        }
      }
      const storedIndex = this.tabbarState[side]!.currentIndex;
      const widget = storedIndex === -1 ? null : tabbarWidget.widget.getWidget(storedIndex);
      tabbarWidget.widget.currentWidget = widget;
      if (!widget) {
        this.commandService.executeCommand(`main-layout.${side}-panel.hide`);
      }
      this.menus.registerMenuAction([`${SIDE_MENU_PATH}/${side}`, '0_global'], {
        label: localize('tabbar.hide', '隐藏'),
        commandId: this.registerGlobalToggleCommand(side as Side),
      });
    }
    this.listenCurrentChange();
  }

  handleSetting = (event) => {
    this.contextMenuRenderer.render(SETTINGS_MENU_PATH, event.nativeEvent);
  }
}
