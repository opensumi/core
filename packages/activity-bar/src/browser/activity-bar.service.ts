import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig } from '@ali/ide-core-browser';
import { ComponentInfo } from '@ali/ide-core-browser/lib/layout';
import { ActivityBarWidget } from './activity-bar-widget.view';
import { ActivityPanelWidget } from '@ali/ide-activity-panel/lib/browser/activity-panel-widget';
import { ActivityBarHandler } from './activity-bar-handler';
import { ViewsContainerWidget } from '@ali/ide-activity-panel/lib/browser/views-container-widget';

interface PTabbarWidget {
  widget: ActivityBarWidget;
  weights: number[];
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

  @Autowired(AppConfig)
  private config: AppConfig;

  constructor() {
    super();
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

  append(componentInfo: ComponentInfo, side: Side): string {
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      const tabbar = tabbarWidget.widget;
      const { component, initialProps, iconClass, onActive, onInActive, onCollapse, weight, componentId, title, viewId, viewName } = componentInfo;
      // TODO 基于view的initialProps、事件等等需要重新设计
      const widget = new ViewsContainerWidget({title: title!, icon: iconClass!, id: componentId!}, [{component, id: viewId || componentId!, name: viewName || title!}], this.config);
      widget.title.iconClass = `activity-icon ${iconClass}`;
      const insertIndex = this.measurePriority(tabbarWidget.weights, weight);
      tabbar.addWidget(widget, side, insertIndex);
      if (onActive || onInActive) {
        tabbar.currentChanged.connect((tabbar, args) => {
          const { currentWidget, previousWidget } = args;
          if (currentWidget === widget) {
            // tslint:disable-next-line:no-unused-expression
            onActive && onActive();
          } else if (previousWidget === widget) {
            // tslint:disable-next-line:no-unused-expression
            onInActive && onInActive();
          }
        }, this);
      }
      if (onCollapse) {
        tabbar.onCollapse.connect((tabbar, title) => {
          if (widget.title === title) {
            onCollapse();
          }
        }, this);
      }
      this.handlerMap.set(componentId!, new ActivityBarHandler(widget.title, tabbar, this.config));
      return componentId!;
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
      return '';
    }
  }

  getTabbarWidget(side: Side): PTabbarWidget {
    return this.tabbarWidgetMap.get(side)!;
  }

  getTabbarHandler(handler: string): ActivityBarHandler | undefined {
    return this.handlerMap.get(handler)!;
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
