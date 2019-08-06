import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig } from '@ali/ide-core-browser';
import { ComponentInfo } from '@ali/ide-core-browser/lib/layout';
import { ActivatorBarWidget } from './activator-bar-widget.view';
import { ActivatorPanelWidget } from '@ali/ide-activator-panel/lib/browser/activator-panel-widget';

interface TabbarWidget {
  widget: ActivatorBarWidget;
  weights: number[];
}

// ActivatorBarService是单例的，对应的Phospher TabbarService是多例的
@Injectable()
export class ActivatorBarService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private tabbarWidgetMap: Map<string, TabbarWidget> = new Map([
    ['left', {
      widget: this.injector.get(ActivatorBarWidget, ['left']),
      weights: [],
    }],
    ['right', {
      widget: this.injector.get(ActivatorBarWidget, ['right']),
      weights: [],
    }],
  ]);

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

  append = (componentInfo: ComponentInfo, side: Side) => {
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    if (tabbarWidget) {
      const tabbar = tabbarWidget.widget;
      const { component, initialProps, iconClass, onActive, onCollapse, weight } = componentInfo;
      const widget = new ActivatorPanelWidget(component, this.config, initialProps || {});
      widget.title.iconClass = `activator-icon ${iconClass}`;
      const insertIndex = this.measurePriority(tabbarWidget.weights, weight);
      tabbar.addWidget(widget, side, insertIndex);
      // 如果当前的组件插入的位置为第一，则需要更新当前激活的组件
      if (insertIndex === 0) {
        tabbar.currentWidget = widget;
      }
      if (onActive) {
        // TODO 期望的上下文需要看实际的使用需求，目前理解用户应该不在意上下文
        tabbar.currentChanged.connect((tabbar, args) => {
          const { currentWidget } = args;
          if (currentWidget === widget) {
            onActive();
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
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
    }
  }

  getTabbarWidget(side: Side): TabbarWidget {
    return this.tabbarWidgetMap.get(side)!;
  }

}

export type Side = 'left' | 'right';
