import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SlotRenderer, ConfigProvider, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired, Optinal, Inject } from '@ali/common-di';
import { IEventBus, BasicEvent } from '@ali/ide-core-common';
import { BoxLayout, TabBar, Widget, StackedPanel } from '@phosphor/widgets';

const WIDGET_OPTION = Symbol();

@Injectable()
export class ActivatorPanelWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;

  constructor(@Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.stackedPanel = new StackedPanel();
    const layout = new BoxLayout({ direction: 'top-to-bottom', spacing: 0 });

    BoxLayout.setStretch(this.stackedPanel, 1);

    layout.addWidget(this.stackedPanel);

    this.layout = layout;
  }
  readonly stackedPanel: StackedPanel;
}
