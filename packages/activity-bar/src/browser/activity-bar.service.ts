import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig, IContextKeyService, WithEventBus, OnEvent, SlotLocation, Command, CommandRegistry, KeybindingRegistry, CommandService, StorageProvider, IStorage, LayoutProviderState, STORAGE_NAMESPACE, MaybeNull, MenuModelRegistry } from '@ali/ide-core-browser';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { ActivityBarHandler } from './activity-bar-handler';
import { ViewsContainerWidget, findClosestPart } from '@ali/ide-activity-panel/lib/browser/views-container-widget';
import { ViewContainerOptions, View, ResizeEvent, ITabbarWidget, SideState, SideStateManager, RenderedEvent } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanelToolbar } from '@ali/ide-activity-panel/lib/browser/activity-panel-toolbar';
import { TabBarToolbarRegistry, TabBarToolbar } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { BoxLayout, BoxPanel, Widget } from '@phosphor/widgets';
import { ViewContextKeyRegistry } from '@ali/ide-activity-panel/lib/browser/view-context-key.registry';
import { IdeWidget } from '@ali/ide-core-browser/lib/layout/ide-widget.view';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import { SIDE_MENU_PATH, SETTINGS_MENU_PATH } from '../common';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';

interface PTabbarWidget {
  widget: ActivityBarWidget;
  containers: BoxPanel[];
  weights: number[];
}

interface ContainerWrap {
  titleWidget: ActivityPanelToolbar;
  container?: ViewsContainerWidget;
  sideWrap: ExtendBoxPanel;
  side: Side;
}

// 用于显示隐藏功能
interface ExtendBoxPanel extends BoxPanel {
  command: string;
  containerId: string;
  inVisible?: boolean;
}

// ActivityBarService是单例的，对应的Phospher TabbarService是多例的
@Injectable()
export class ActivityBarService extends WithEventBus {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private tabbarWidgetMap: Map<string, PTabbarWidget> = new Map([
    ['left', {
      widget: this.injector.get(ActivityBarWidget, ['left']),
      weights: [],
      containers: [],
    }],
    ['right', {
      widget: this.injector.get(ActivityBarWidget, ['right']),
      weights: [],
      containers: [],
    }],
    ['bottom', {
      widget: this.injector.get(ActivityBarWidget, ['bottom']),
      weights: [],
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

  @OnEvent(RenderedEvent)
  protected onRender() {
    for (const containerWrap of this.containersMap.values()) {
      if (containerWrap.container) {
        containerWrap.container.restoreState();
      }
    }
  }

  public getContainer(viewOrContainerId: string) {
    let containerWrap = this.containersMap.get(viewOrContainerId);
    if (containerWrap) {
      if (!(containerWrap.container instanceof ViewsContainerWidget)) {
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

  private measurePriority(weights: number[], weight?: number): number {
    if (!weights.length) {
      weights.splice(0, 0, weight || 0);
      return 0;
    }
    let i = weights.length - 1;
    if (!weight) {
      weights.splice(i + 1, 0, 0);
      return i + 1;
    }
    for (; i >= 0; i--) {
      if (weight < weights[i]) {
        break;
      }
    }
    weights.splice(i + 1, 0, weight);
    return i + 1;
  }

  protected createTitleBar(side: Side, widget: any, view?: View) {
    return this.injector.get(ActivityPanelToolbar, [side, widget, view]);
  }

  protected createSideContainer(widget: Widget, containerId: string, titleBar?: Widget): ExtendBoxPanel {
    const containerLayout = new BoxLayout({ direction: 'top-to-bottom', spacing: 0 });
    if (titleBar) {
      BoxPanel.setStretch(titleBar, 0);
      containerLayout.addWidget(titleBar);
    }
    BoxPanel.setStretch(widget, 1);
    containerLayout.addWidget(widget);
    const boxPanel = new BoxPanel({ layout: containerLayout }) as ExtendBoxPanel;
    boxPanel.addClass('side-container');
    boxPanel.command = this.registerVisibleToggleCommand(containerId);
    boxPanel.containerId = containerId;
    return boxPanel;
  }

  // append一个viewContainer，支持传入初始化views
  append(views: View[], options: ViewContainerOptions, side: Side): string {
    const { iconClass, weight, containerId, title, initialProps, expanded } = options;
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      let panelContainer: ExtendBoxPanel;
      if (side !== 'bottom') {
        const widget = this.injector.get(ViewsContainerWidget, [{ title: title!, icon: iconClass!, id: containerId! }, views, side]);
        const titleWidget: ActivityPanelToolbar = this.createTitleBar(side, widget, views[0]);
        titleWidget.toolbarTitle = widget.title;
        widget.titleWidget = titleWidget;
        if (!title) {
          // titleBar只会在仅有一个view时展示图标
          titleWidget.setHidden(true);
        }
        panelContainer = this.createSideContainer(widget, containerId, titleWidget);
        if (expanded === true) {
          panelContainer.addClass('expanded');
        }
        this.containersMap.set(containerId, {
          titleWidget: titleWidget!,
          container: widget,
          sideWrap: panelContainer,
          side,
        });
        this.tabbarWidgetMap.get(side)!.containers.push(panelContainer);
        for (const view of views) {
          // 存储通过viewId获取ContainerId的MAP
          this.viewToContainerMap.set(view.id, containerId);
          if (view.component) {
            widget.addWidget(view, initialProps);
          }
        }
        panelContainer.title.iconClass = `activity-icon ${iconClass}`;
      } else {
        panelContainer = new BoxPanel({spacing: 0}) as ExtendBoxPanel;
        panelContainer.command = this.registerVisibleToggleCommand(containerId);
        const bottomWidget = this.injector.get(IdeWidget, [this.config, views[0].component, 'bottom']);
        // 底部不使用viewContainer，手动加上id
        // @ts-ignore
        bottomWidget.containerId = containerId;
        const contextKeyService = this.viewContextKeyRegistry.registerContextKeyService(containerId, this.contextKeyService.createScoped());
        contextKeyService.createKey('view', containerId);

        const bottomToolBar = this.createTitleBar('bottom', bottomWidget, views[0]);
        bottomToolBar.toolbarTitle = bottomWidget.title;
        BoxPanel.setStretch(bottomToolBar, 0);
        BoxPanel.setStretch(bottomWidget, 1);
        panelContainer.addClass('bottom-container');
        panelContainer.addWidget(bottomToolBar);
        panelContainer.addWidget(bottomWidget);

        this.containersMap.set(containerId, {
          titleWidget: bottomToolBar,
          sideWrap: panelContainer,
          side,
        });

        bottomWidget.addClass('overflow-visible');
        bottomWidget.addClass('bottom-wrap');
        bottomToolBar.addClass('overflow-visible');
        panelContainer.addClass('overflow-visible');
      }

      // 用于右键菜单显示
      panelContainer.title.label = title!;
      // dataset小写，会渲染到tab的li节点上
      panelContainer.title.dataset = {
        containerid: containerId,
      };
      const insertIndex = this.measurePriority(tabbarWidget.weights, weight);
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
        const { sideWrap } = this.containersMap.get(containerId)!;
        return !sideWrap.inVisible;
      },
    });
    return commandId;
  }

  protected doToggleTab(containerId: string, forceShow?: boolean) {
    const { sideWrap, side } = this.containersMap.get(containerId)!;
    const tabbar = this.tabbarWidgetMap.get(side)!.widget.tabBar;
    const prevState = sideWrap.inVisible;
    if (forceShow === true) {
      sideWrap.inVisible = true;
    } else if (forceShow === false) {
      sideWrap.inVisible = false;
    }
    if (sideWrap.inVisible) {
      sideWrap.inVisible = false;
      // sideWrap.setHidden(false);
      // tabbar.currentTitle = sideWrap.title;
      tabbar.update();
    } else {
      sideWrap.inVisible = true;
      sideWrap.setHidden(true);
      if (tabbar.currentTitle === sideWrap.title) {
        tabbar.currentTitle = tabbar.titles.find((title) => title !== tabbar.currentTitle && !(title.owner as ExtendBoxPanel).inVisible)!;
      } else {
        tabbar.update();
      }
    }
    if (sideWrap.inVisible !== prevState) {
      const tab = this.tabbarState[side]!.tabbars.find((tab) => tab.containerId === sideWrap.containerId)!;
      if (!tab) {
        this.tabbarState[side]!.tabbars.push({
          containerId: sideWrap.containerId,
          hidden: false,
        });
      } else {
        tab.hidden = sideWrap.inVisible;
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
          (currentWidget as BoxPanel).widgets[0].update();
          // @ts-ignore
          const containerId = currentWidget.containerId;
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
      this.menus.registerMenuAction([`${SIDE_MENU_PATH}/${side}`, '0_global'], {
        // TODO i18n
        label: 'Hide',
        commandId: this.registerGlobalToggleCommand(side as Side),
      });
    }
    this.listenCurrentChange();
  }

  handleSetting = (event) => {
    this.contextMenuRenderer.render(SETTINGS_MENU_PATH, event.nativeEvent);
  }
}

export type Side = 'left' | 'right' | 'bottom';
