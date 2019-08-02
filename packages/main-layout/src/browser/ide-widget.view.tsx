import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SlotRenderer, ConfigProvider, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired, Optinal, Inject, ConstructorOf } from '@ali/common-di';
import { IEventBus } from '@ali/ide-core-common';
import { Widget } from '@phosphor/widgets';
import { SlotLocation, ResizeEvent, ResizePayload } from '../common';
import { Message } from '@phosphor/messaging';
import { Signal } from '@phosphor/signaling/lib';
import { resolve } from 'path';

const WIDGET_OPTION = Symbol();
const WIDGET_LOCATION = Symbol();
const WIDGET_CONFIGCONTEXT = Symbol();
const WIDGET_COMPONENT = Symbol();

@Injectable()
export class IdeWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;
  readonly onBeforeShowHandle = new Signal<this, void>(this);
  readonly onAfterShowHandle = new Signal<this, void>(this);
  readonly onBeforeHideHandle = new Signal<this, void>(this);
  readonly onAfterHideHandle = new Signal<this, void>(this);

  constructor(
    @Inject(WIDGET_CONFIGCONTEXT) private configContext: AppConfig,
    @Inject(WIDGET_COMPONENT) private Component?: React.FunctionComponent,
    @Inject(WIDGET_LOCATION) private slotLocation?: SlotLocation,
    @Optinal(WIDGET_OPTION) options?: Widget.IOptions,
    ) {
    super(options);
    this.initWidget();
  }

  protected onAfterHide(msg: Message) {
    this.onAfterHideHandle.emit();
  }
  protected onBeforeHide(msg: Message) {
    this.onBeforeHideHandle.emit();
  }
  protected onAfterShow(msg: Message) {
    this.onAfterShowHandle.emit();
  }
  protected onBeforeShow(msg: Message) {
    this.onBeforeShowHandle.emit();
  }

  private initWidget = () => {
    if (this.Component) {
      ReactDOM.render(
        <ConfigProvider value={this.configContext} >
          <SlotRenderer Component={this.Component} />
        </ConfigProvider>
      , this.node);
    } else {
      ReactDOM.render(<div style={{backgroundColor: '#282C34', height: '100%'}}>${this.slotLocation || 'placeholder'}</div>, this.node);
    }
  }

  // 使用ReactComponent重新render，替代placeholder
  async setComponent(component) {
    return new Promise((resolve) => {
      ReactDOM.render(
        <ConfigProvider value={this.configContext} >
          <SlotRenderer Component={component} />
        </ConfigProvider>
      , this.node, () => {
        resolve();
      });
    });

  }

  // 使用Widget重新render
  setWidget(widget: Widget) {
    this.node.innerHTML = '';
    Widget.attach(widget, this.node);
  }

  onResize = (resizeMessage: Widget.ResizeMessage) => {
    // 需要resize的位置才传
    if (this.slotLocation) {
      this.eventBus.fire(new ResizeEvent(new ResizePayload(resizeMessage.width, resizeMessage.height, this.slotLocation)));
    }
  }

}
