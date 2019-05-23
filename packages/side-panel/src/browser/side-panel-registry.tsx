import { SidePanelHandler } from './side-panel-handler';
import { Injectable, Autowired } from '@ali/common-di';
import { Widget } from '@phosphor/widgets';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Disposable, AppConfig, ConfigProvider, IRootApp } from '@ali/ide-core-browser';

export interface WidgetInfo {
  name: string;
  iconClass: string;
  description: string;
}

export interface ComponentInfo {
  component: React.FunctionComponent;
  widgetInfo: WidgetInfo;
}

class ContentWidget extends Widget {

  // TODO @常浅 phosphor 和应用的结合机制需要再设计
  static createNode(Component: React.FunctionComponent, config: AppConfig): HTMLElement {
    const node = document.createElement('div');
    ReactDOM.render((
      <ConfigProvider value={config} >
        <Component />
      </ConfigProvider>
    ), node);

    return node;
  }

  constructor(Component: React.FunctionComponent, widgetInfo: WidgetInfo, config: AppConfig) {
    super({ node: ContentWidget.createNode(Component, config) });
    this.setFlag(Widget.Flag.DisallowLayout);
    this.title.label = widgetInfo.name;
    this.title.caption = widgetInfo.description;
    this.title.iconClass = widgetInfo.iconClass;
  }

}

@Injectable()
export class SidePanelRegistry extends Disposable {
  @Autowired(IRootApp)
  private rootApp: IRootApp;

  @Autowired()
  private sidePanelHandler!: SidePanelHandler;

  private components: Array<ComponentInfo> = [];

  registerComponent(Component: React.FunctionComponent, widgetInfo: WidgetInfo) {
    this.components.push({
      component: Component,
      widgetInfo,
    });
  }

  renderComponents() {
    for (const componentInfo of this.components) {
      const widget = new ContentWidget(componentInfo.component, componentInfo.widgetInfo, this.rootApp.config);
      widget.addClass(`side-panel-${componentInfo.widgetInfo.name}`);
      this.sidePanelHandler.addTab(widget.title);
    }
  }
}
