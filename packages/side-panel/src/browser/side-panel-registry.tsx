import { SidePanelHandler } from './side-panel-handler';
import { Injectable, Autowired } from '@ali/common-di';
import { Widget } from '@phosphor/widgets';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Disposable } from '@ali/ide-core-browser';

export interface WidgetInfo {
  name: string;
  iconClass: string;
  description: string;
}

class ContentWidget extends Widget {

  static createNode(Component: React.FunctionComponent): HTMLElement {
    const node = document.createElement('div');
    ReactDOM.render(<Component />, node);
    return node;
  }

  constructor(Component: React.FunctionComponent, widgetInfo: WidgetInfo) {
    super({ node: ContentWidget.createNode(Component) });
    this.setFlag(Widget.Flag.DisallowLayout);
    this.title.label = widgetInfo.name;
    this.title.caption = widgetInfo.description;
  }

}

@Injectable()
export class SidePanelRegistry extends Disposable {
  @Autowired()
  sidePanelHandler!: SidePanelHandler;

  registerComponent(Component: React.FunctionComponent, widgetInfo: WidgetInfo) {
    const widget = new ContentWidget(Component, widgetInfo);
    widget.addClass('side-panel-init')
    this.sidePanelHandler.addTab(widget.title);
  }
}
