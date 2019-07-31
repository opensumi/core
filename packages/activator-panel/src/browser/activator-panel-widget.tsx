import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigProvider, AppConfig, SlotRenderer } from '@ali/ide-core-browser';
import { Injectable, Optinal, Inject } from '@ali/common-di';
import { Widget } from '@phosphor/widgets';

const WIDGET_OPTION = Symbol();
const WIDGET_FC = Symbol();
const WIDGET_CONFIGCONTEXT = Symbol();

export class ActivatorPanelWidget extends Widget {

  constructor(@Inject(WIDGET_FC) private Fc: React.FunctionComponent, @Inject(WIDGET_CONFIGCONTEXT) private configContext: AppConfig, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);
    this.initWidget();
  }
  private initWidget = () => {
    const Fc = this.Fc;
    if (Fc) {
      ReactDOM.render(
        <ConfigProvider value={this.configContext} >
          <SlotRenderer Component={Fc} />
        </ConfigProvider>
      , this.node);
    }
  }
}
