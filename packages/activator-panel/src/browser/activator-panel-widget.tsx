import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ConfigProvider, AppConfig, SlotRenderer } from '@ali/ide-core-browser';
import { Widget } from '@phosphor/widgets';

export class ActivatorPanelWidget extends Widget {

  constructor(private Fc: React.FunctionComponent, private configContext: AppConfig, private initialProps: object) {
    super();
    this.initWidget();
  }
  private initWidget = () => {
    const Fc = this.Fc;
    if (Fc) {
      ReactDOM.render(
        <ConfigProvider value={this.configContext} >
          <SlotRenderer Component={Fc} initialProps={this.initialProps} />
        </ConfigProvider>
      , this.node);
    }
  }
}
