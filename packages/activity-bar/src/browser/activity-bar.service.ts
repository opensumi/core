import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig, IContextKeyService } from '@ali/ide-core-browser';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { ActivityBarHandler } from './activity-bar-handler';
import { ViewsContainerWidget } from '@ali/ide-activity-panel/lib/browser/views-container-widget';
import { ViewContainerOptions, View } from '@ali/ide-core-browser/lib/layout';
import { ActivityPanelToolbar } from '@ali/ide-activity-panel/lib/browser/activity-panel-toolbar';
import { TabBarToolbarRegistry, TabBarToolbar } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { BoxLayout, BoxPanel, Widget } from '@phosphor/widgets';
import { ViewContextKeyRegistry } from '@ali/ide-activity-panel/lib/browser/view-context-key.registry';

interface PTabbarWidget {
  widget: ActivityBarWidget;
  weights: number[];
}

interface ContainerWrap {
  titleWidget: ActivityPanelToolbar;
  container: ViewsContainerWidget;
}

// ActivityBarService是单例的，对应的Phospher TabbarService是多例的
@Injectable()
export class ActivityBarService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private tabbarWidgetMap: Map<string, PTabbarWidget> = new Map([
    ['left', {
      widget: this.injector.get(ActivityBarWidget, ['left']),
      weights: [],
    }],
    ['right', {
      widget: this.injector.get(ActivityBarWidget, ['right']),
      weights: [],
    }],
  ]);

  private handlerMap: Map<string, ActivityBarHandler> = new Map();
  private viewToContainerMap: Map<string, string> = new Map();
  private containerToViewMap: Map<string, string[]> = new Map();
  private containersMap: Map<string, ContainerWrap> = new Map();
  private widgetToIdMap: Map<Widget, string> = new Map();

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired()
  viewContextKeyRegistry: ViewContextKeyRegistry;

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
    );
  }

  protected createSideContainer(widget: Widget, titleBar?: Widget) {
    const containerLayout = new BoxLayout({ direction: 'top-to-bottom', spacing: 0 });
    if (titleBar) {
      BoxPanel.setStretch(titleBar, 0);
      containerLayout.addWidget(titleBar);
    }
    BoxPanel.setStretch(widget, 1);
    containerLayout.addWidget(widget);
    const boxPanel = new BoxPanel({ layout: containerLayout });
    boxPanel.addClass('side-container');
    return boxPanel;
  }

  // append一个viewContainer，支持传入初始化views
  append(views: View[], options: ViewContainerOptions, side: Side): string {
    const { iconClass, weight, containerId, title, initialProps } = options;
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      const tabbar = tabbarWidget.widget;
      const widget = new ViewsContainerWidget({ title: title!, icon: iconClass!, id: containerId! }, views, this.config, this.injector, side);
      let titleWidget: ActivityPanelToolbar | undefined;
      if (title) {
        // titleBar只会在仅有一个view时展示图标
        titleWidget = this.createTitleBar(side, widget, views[0]);
        titleWidget.toolbarTitle = widget.title;
        this.containersMap.set(containerId, {
          titleWidget,
          container: widget,
        });
      }
      const sideContainer = this.createSideContainer(widget, titleWidget);
      this.widgetToIdMap.set(sideContainer, containerId);
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
          // 通过append api的view必须带component
          widget.addWidget(view, view.component, initialProps);
        }
      }
      sideContainer.title.iconClass = `activity-icon ${iconClass}`;
      const insertIndex = this.measurePriority(tabbarWidget.weights, weight);
      tabbar.addWidget(sideContainer, side, insertIndex);
      this.handlerMap.set(containerId!, new ActivityBarHandler(sideContainer.title, tabbar, this.config));
      return containerId!;
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
      return '';
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
      const widgets = tabbarWidget.widget.getWidgets();
      tabbarWidget.widget.currentWidget = hide ? null : widgets[0];
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
    }
  }
}

export type Side = 'left' | 'right';
