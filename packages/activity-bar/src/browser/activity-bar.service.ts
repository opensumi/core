import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig, IContextKeyService, WithEventBus, OnEvent, SlotLocation, Command, CommandRegistry, KeybindingRegistry, CommandService } from '@ali/ide-core-browser';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { ActivityBarHandler } from './activity-bar-handler';
import { ViewsContainerWidget } from '@ali/ide-activity-panel/lib/browser/views-container-widget';
import { ViewContainerOptions, View, ResizeEvent, ITabbarWidget } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanelToolbar } from '@ali/ide-activity-panel/lib/browser/activity-panel-toolbar';
import { TabBarToolbarRegistry, TabBarToolbar } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { BoxLayout, BoxPanel, Widget } from '@phosphor/widgets';
import { ViewContextKeyRegistry } from '@ali/ide-activity-panel/lib/browser/view-context-key.registry';
import { IdeWidget } from '@ali/ide-core-browser/lib/layout/ide-widget.view';

interface PTabbarWidget {
  widget: ActivityBarWidget;
  containers: BoxPanel[];
  weights: number[];
}

interface ContainerWrap {
  titleWidget: ActivityPanelToolbar;
  container: ViewsContainerWidget;
  sideWrap: ExtendBoxPanel;
  side: Side;
}

// 用于显示隐藏功能
interface ExtendBoxPanel extends BoxPanel {
  command: string;
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
  private containerToViewMap: Map<string, string[]> = new Map();
  private containersMap: Map<string, ContainerWrap> = new Map();
  private widgetToIdMap: Map<Widget, string> = new Map();
  private timer: NodeJS.Timeout;

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

  constructor() {
    super();
    this.listenCurrentChange();
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

  protected createTitleBar(side, widget, view) {
    return new ActivityPanelToolbar(
      this.injector.get(TabBarToolbarRegistry),
      this.injector.get(TabBarToolbar),
      side,
      widget,
      view,
      this.config,
    );
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
    return boxPanel;
  }

  // append一个viewContainer，支持传入初始化views
  append(views: View[], options: ViewContainerOptions, side: Side): string {
    const { iconClass, weight, containerId, title, initialProps } = options;
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      let panelContainer: ExtendBoxPanel;
      if (side !== 'bottom') {
        const widget = new ViewsContainerWidget({ title: title!, icon: iconClass!, id: containerId! }, views, this.config, this.injector, side);
        let titleWidget: ActivityPanelToolbar | undefined;
        if (title) {
          // titleBar只会在仅有一个view时展示图标
          titleWidget = this.createTitleBar(side, widget, views[0]);
          titleWidget.toolbarTitle = widget.title;
        }
        panelContainer = this.createSideContainer(widget, containerId, titleWidget);
        this.containersMap.set(containerId, {
          titleWidget: titleWidget!,
          container: widget,
          sideWrap: panelContainer,
          side,
        });
        this.tabbarWidgetMap.get(side)!.containers.push(panelContainer);
        this.widgetToIdMap.set(panelContainer, containerId);
        for (const view of views) {
          // 存储通过viewId获取ContainerId的MAP
          this.viewToContainerMap.set(view.id, containerId);
          const containerViews = this.containerToViewMap.get(containerId);
          if (!containerViews) {
            this.containerToViewMap.set(containerId, [view.id]);
          } else {
            containerViews.push(view.id);
          }
          if (view.component) {
            widget.addWidget(view, view.component, initialProps);
          }
        }
        panelContainer.title.iconClass = `activity-icon ${iconClass}`;
      } else {
        panelContainer = new BoxPanel() as ExtendBoxPanel;
        panelContainer.command = this.registerVisibleToggleCommand(containerId);
        const bottomWidget = this.injector.get(IdeWidget, [this.config, views[0].component, 'bottom']);
        BoxPanel.setStretch(bottomWidget, 1);
        panelContainer.addClass('bottom-container');
        panelContainer.addWidget(bottomWidget);
      }

      // 用于右键菜单显示
      panelContainer.title.label = title!;
      const insertIndex = this.measurePriority(tabbarWidget.weights, weight);
      const tabbar = tabbarWidget.widget;
      tabbar.addWidget(panelContainer, side, insertIndex);
      this.handlerMap.set(containerId!, new ActivityBarHandler(containerId, panelContainer.title, tabbar, side, this.commandService, this.config));
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

  // 注册tab的隐藏显示功能
  private registerVisibleToggleCommand(containerId: string): string {
    const commandId = `activity.bar.toggle.${containerId}`;
    this.commandRegistry.registerCommand({
      id: commandId,
    }, {
      execute: (forceShow?: boolean) => {
        const { sideWrap, side } = this.containersMap.get(containerId)!;
        const tabbar = this.tabbarWidgetMap.get(side)!.widget.tabBar;
        if (forceShow === true) {
          sideWrap.inVisible = true;
        } else if (forceShow === false) {
          sideWrap.inVisible = false;
        }
        if (sideWrap.inVisible) {
          sideWrap.inVisible = false;
          sideWrap.setHidden(false);
          tabbar.currentTitle = sideWrap.title;
        } else {
          sideWrap.inVisible = true;
          sideWrap.setHidden(true);
          if (tabbar.currentTitle === sideWrap.title) {
            tabbar.currentTitle = tabbar.titles.find((title) => title !== tabbar.currentTitle)!;
          } else {
            tabbar.update();
          }
        }
      },
    });
    return commandId;
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    const side = e.payload.slotLocation;
    if (side === SlotLocation.left || side === SlotLocation.right) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        for (const sideContainer of this.tabbarWidgetMap.get('left')!.containers) {
          sideContainer.update();
        }
        for (const sideContainer of this.tabbarWidgetMap.get('right')!.containers) {
          sideContainer.update();
        }
      }, 60);
    }
  }

  listenCurrentChange() {
    for (const pTabbar of this.tabbarWidgetMap.values()) {
      const tabbar = pTabbar.widget;
      tabbar.currentChanged.connect((tabbar, args) => {
        const { currentWidget } = args;
        if (currentWidget) {
          (currentWidget as BoxPanel).widgets[0].update();
          const containerId = this.widgetToIdMap.get(currentWidget);
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

  getTabbarWidget(side: Side): PTabbarWidget {
    return this.tabbarWidgetMap.get(side)!;
  }

  getTabbarHandler(viewOrContainerId: string): ActivityBarHandler | undefined {
    let activityHandler = this.handlerMap.get(viewOrContainerId);
    if (!activityHandler) {
      const containerId = this.viewToContainerMap.get(viewOrContainerId);
      if (containerId) {
        activityHandler = this.handlerMap.get(containerId);
      }
    }
    return activityHandler;
  }

  refresh(side, hide?: boolean) {
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      const widget = tabbarWidget.widget.getWidget(0);
      tabbarWidget.widget.currentWidget = hide ? null : widget;
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
    }
  }
}

export type Side = 'left' | 'right' | 'bottom';
