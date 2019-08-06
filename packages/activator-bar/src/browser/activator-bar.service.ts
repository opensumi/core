import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, AppConfig } from '@ali/ide-core-browser';
import { ComponentInfo } from '@ali/ide-core-browser/lib/layout';
import { ActivatorBarWidget } from './activator-bar-widget.view';
import { ActivatorPanelWidget } from '@ali/ide-activator-panel/lib/browser/activator-panel-widget';

// ActivatorBarService是单例的，对应的Phospher TabbarService是多例的
@Injectable()
export class ActivatorBarService extends Disposable {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private tabbarWidgetMap: Map<string, ActivatorBarWidget> = new Map([
    ['left', this.injector.get(ActivatorBarWidget, ['left'])],
    ['right', this.injector.get(ActivatorBarWidget, ['right'])],
  ]);

  @Autowired(AppConfig)
  private config: AppConfig;

  constructor() {
    super();
  }

  append = (componentInfo: ComponentInfo, side: Side) => {
    const tabbarWidget = this.tabbarWidgetMap.get(side);
    const {component, initialProps, iconClass, onActive, onCollapse} = componentInfo;
    if (tabbarWidget) {
      const widget = new ActivatorPanelWidget(component, this.config, initialProps || {});
      widget.title.iconClass = `activator-icon ${iconClass}`;
      tabbarWidget.addWidget(widget, side);
      if (onActive) {
        // TODO 期望的上下文需要看实际的使用需求，目前理解用户应该不在意上下文
        tabbarWidget.currentChanged.connect((tabbarWidget, args) => {
          const {currentWidget} = args;
          if (currentWidget === widget) {
            onActive();
          }
        }, this);
      }
      if (onCollapse) {
        tabbarWidget.onCollapse.connect((tabbarWidget, title) => {
          if (widget.title === title) {
            onCollapse();
          }
        }, this);
      }
    } else {
      console.warn('没有找到该位置的Tabbar，请检查传入的位置！');
    }
  }

  getTabbarWidget(side: Side): ActivatorBarWidget {
    return this.tabbarWidgetMap.get(side)!;
  }

}

export type Side = 'left' | 'right';
