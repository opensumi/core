import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { IEventBus } from '@ali/ide-core-common';
import { Widget, SingletonLayout, DockPanel } from '@phosphor/widgets';

const WIDGET_OPTION = Symbol();

@Injectable()
export class BottomDockPanelWidget extends Widget {

  constructor(@Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.dockPanel = new DockPanel();
    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});

    layout.widget = this.dockPanel;

    this.layout = layout;
  }

  addWidget(widget: Widget): void {
    this.dockPanel.addWidget(widget);
  }

  readonly dockPanel: DockPanel;
}

export namespace BottomDockPanelWidget {
}
