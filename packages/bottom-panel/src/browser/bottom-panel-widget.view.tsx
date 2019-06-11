import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SlotRenderer, ConfigProvider, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired, Optinal, Inject } from '@ali/common-di';
import { IEventBus, BasicEvent } from '@ali/ide-core-common';
import { BoxLayout, TabBar, Widget, StackedPanel } from '@phosphor/widgets';

const WIDGET_OPTION = Symbol();
const WIDGET_FC = Symbol();
const WIDGET_CONFIGCONTEXT = Symbol();

@Injectable()
export class BottomPanelWidget extends Widget {

  constructor(@Inject(WIDGET_FC) private Fc: React.FunctionComponent, @Inject(WIDGET_CONFIGCONTEXT) private configContext: AppConfig, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);
    this.initWidget();
  }
  private initWidget = () => {
    const Fc = this.Fc;
    if (Fc) {
      ReactDOM.render(
        <ConfigProvider value={this.configContext} >
          <Fc />
        </ConfigProvider>
      , this.node);
    }
  }
}
