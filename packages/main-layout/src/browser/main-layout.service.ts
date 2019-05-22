import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { CommandService } from '../../../core-common/src/command';
import { SlotLocation } from '../common/main-layout-slot';
import {
  Widget,
} from '@phosphor/widgets';
import { PanelSize } from '../common';

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

  setPanelSize = (slotName: SlotLocation, panelSize: PanelSize) => {
    const widget = this.slotWidgetMap.get(slotName);
    if (widget) {
      if (panelSize.width) {
        widget.node.style.width = panelSize.width + 'px';
      }
      if (panelSize.height) {
        widget.node.style.height = panelSize.height + 'px';
      }
    }
  }

}
