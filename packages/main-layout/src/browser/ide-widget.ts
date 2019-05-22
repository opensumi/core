import { Injectable, Autowired, Optinal } from '@ali/common-di';
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

@Injectable()
export class IdeWidget extends Widget {

  @Autowired(IEventBus)
  private eventBus!: IEventBus;

  constructor(@Optinal(WIDGET_LOCATION) private slotLocation: SlotLocation, @Optinal(WIDGET_OPTION) options?: Widget.IOptions) {
    super(options);
  }

  onResize = (resizeMessage: Widget.ResizeMessage) => {
    this.eventBus.fire(new ResizeEvent(new ResizePayload(resizeMessage.width, resizeMessage.height, this.slotLocation)));
  }

}
