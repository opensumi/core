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
  side: Side;
}

export interface ComponentInfo {
  component: React.FunctionComponent;
  widgetInfo: WidgetInfo;
}

export type Side = 'left' | 'right';

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

  private leftComponents: Array<ComponentInfo> = [];
  private rightComponents: Array<ComponentInfo> = [];

  constructor(
    private leftSidePanelHandler: SidePanelHandler,
    private rightSidePanelHandler: SidePanelHandler,
  ) {
    super();
  }

  registerComponent(Component: React.FunctionComponent, widgetInfo: WidgetInfo) {
    if (widgetInfo.side === 'left') {
      this.leftComponents.push({
        component: Component,
        widgetInfo,
      });
    } else {
      this.rightComponents.push({
        component: Component,
        widgetInfo,
      });
    }
  }

  renderComponents(side: Side, container: HTMLElement) {
    if (side === 'left') {
      this.leftSidePanelHandler.create('left');
      for (const componentInfo of this.leftComponents) {
        const widget = new ContentWidget(componentInfo.component, componentInfo.widgetInfo, this.rootApp.config);
        widget.addClass(`left-panel-${componentInfo.widgetInfo.name}`);
        this.leftSidePanelHandler.addTab(widget.title);
      }
      Widget.attach(this.leftSidePanelHandler.container, container);
    } else {
      this.rightSidePanelHandler.create('right');
      for (const componentInfo of this.rightComponents) {
        const widget = new ContentWidget(componentInfo.component, componentInfo.widgetInfo, this.rootApp.config);
        widget.addClass(`right-panel-${componentInfo.widgetInfo.name}`);
        this.rightSidePanelHandler.addTab(widget.title);
      }
      Widget.attach(this.rightSidePanelHandler.container, container);
    }
  }
}
