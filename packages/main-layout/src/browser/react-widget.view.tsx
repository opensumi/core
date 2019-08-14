import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Widget } from '@phosphor/widgets';
import { ConfigProvider, AppConfig, SlotRenderer } from '@ali/ide-core-browser';

export class ReactWidget extends Widget {
  constructor(
    private configContext: AppConfig,
    private components: React.FunctionComponent[] | React.FunctionComponent,
    options?: Widget.IOptions,
  ) {
    super(options);
    ReactDOM.render((
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={this.components} />
      </ConfigProvider>
    ), this.node);
  }
}
