import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SlotLocation } from '../common/main-layout-slot';
import { Widget } from '@phosphor/widgets';

@Injectable()
export class MainLayoutService extends Disposable {

  private slotWidgetMap: Map<SlotLocation, Widget> = new Map<SlotLocation, Widget>();

  constructor() {
    super();
  }

  registerSlot = (slotName: SlotLocation, widget: Widget) => {
    this.slotWidgetMap.set(slotName, widget);
  }
  unregisterSlot = (slotName: SlotLocation) => {
      this.slotWidgetMap.delete(slotName);
  }

  hidePanel = (slotName: SlotLocation) => {
      const widget = this.slotWidgetMap.get(slotName);
      if (widget) {
          widget.hide();
      }
  }
  showPanel = (slotName: SlotLocation) => {
      const widget = this.slotWidgetMap.get(slotName);
      if (widget) {
          widget.show();
      }
  }

}
