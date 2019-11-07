import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Injectable, Autowired, Optinal, Inject, ConstructorOf } from '@ali/common-di';
import { IEventBus } from '@ali/ide-core-common';
import { Widget } from '@phosphor/widgets';
import { Message } from '@phosphor/messaging';
import { Signal } from '@phosphor/signaling/lib';
import { AppConfig, ConfigProvider, SlotRenderer } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class ReactPanelWidget extends Widget {
  @Autowired(AppConfig)
  configContext: AppConfig;

  constructor(
    private Component: React.FunctionComponent,
    public readonly containerId: string,
    public readonly command: string,
    public inVisible?: boolean,
    options?: Widget.IOptions,
  ) {
    super(options);
    this.initWidget();
  }

  private initWidget = () => {
    ReactDOM.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={this.Component} />
      </ConfigProvider>
    , this.node);
  }

}
