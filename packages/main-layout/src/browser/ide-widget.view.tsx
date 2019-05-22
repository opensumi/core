import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SlotRenderer, ConfigProvider, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired, Optinal, Inject } from '@ali/common-di';
import { IEventBus, BasicEvent } from '@ali/ide-core-common';
import { Widget } from '@phosphor/widgets';
import { SlotLocation } from '@ali/ide-main-layout';

export class ResizePayload {
  constructor(public width: number, public height: number, public slotLocation: SlotLocation) {
  }
}
export class ResizeEvent extends BasicEvent<ResizePayload> {}

const WIDGET_OPTION = Symbol();
const WIDGET_LOCATION = Symbol();
const WIDGET_CONFIGCONTEXT = Symbol();

@Injectable()
export class IdeWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;

  constructor(@Inject(WIDGET_LOCATION) private slotLocation: SlotLocation, @Inject(WIDGET_CONFIGCONTEXT) private configContext: AppConfig, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);
    this.initWidget();
  }

  private initWidget = () => {
    const { slotMap } = this.configContext;
    if (slotMap.has(this.slotLocation)) {
      ReactDOM.render(
        <ConfigProvider value={this.configContext} >
          <SlotRenderer name={this.slotLocation} />
        </ConfigProvider>
      , this.node);
    } else {
      const bgColors = ['#f66', '#66f', '#6f6', '#ff6'];
      const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
      ReactDOM.render(<div style={{backgroundColor: bgColor, height: '100%'}}>${this.slotLocation}</div>, this.node);
    }
  }

  onResize = (resizeMessage: Widget.ResizeMessage) => {
    this.eventBus.fire(new ResizeEvent(new ResizePayload(resizeMessage.width, resizeMessage.height, this.slotLocation)));
  }

}
