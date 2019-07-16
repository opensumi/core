import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Widget } from '@phosphor/widgets';
import { ConfigProvider, AppConfig, SlotRenderer } from '@ali/ide-core-browser';

export class ReactWidget extends Widget {
  constructor(
    private configContext: AppConfig,
    private component: React.FunctionComponent,
    options?: Widget.IOptions,
  ) {
    super(options);
    ReactDOM.render((
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={this.component} />
      </ConfigProvider>
    ), this.node);
  }
}
