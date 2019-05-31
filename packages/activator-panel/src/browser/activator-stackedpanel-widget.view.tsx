import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SlotRenderer, ConfigProvider, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired, Optinal, Inject } from '@ali/common-di';
import { IEventBus, BasicEvent } from '@ali/ide-core-common';
import { BoxLayout, TabBar, Widget, StackedPanel, SingletonLayout } from '@phosphor/widgets';

const WIDGET_OPTION = Symbol();

@Injectable()
export class ActivatorStackedPanelWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;

  constructor(@Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);

    this.stackedPanel = new StackedPanel();
    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});

    layout.widget = this.stackedPanel;

    this.layout = layout;
  }
  readonly stackedPanel: StackedPanel;
}
