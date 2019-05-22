import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { IEventBus, IEventLisnter, IEventFireOpts, EventBusImpl, BasicEvent } from '@ali/ide-core-common';
import { Widget } from '@phosphor/widgets';

export class ResizePayload {
  constructor(public target: HTMLElement, public width: number, public height: number) {
  }

}
export class ResizeEvent extends BasicEvent<ResizePayload> {}

const WIDGET_TOKEN = Symbol();

@Injectable()
export class IdeWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;

  constructor(@Optinal(WIDGET_TOKEN) options?: Widget.IOptions) {
    super(options);
  }

  onResize = (resizeMessage: Widget.ResizeMessage) => {
    this.eventBus.fire(new ResizeEvent(new ResizePayload(this.node, resizeMessage.width, resizeMessage.height)));
  }

}
