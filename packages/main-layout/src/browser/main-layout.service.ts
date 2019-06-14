import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SlotLocation } from '../common/main-layout-slot';
import { Widget, SplitPanel } from '@phosphor/widgets';
import { PanelSize } from '../common';

@Injectable()
export class MainLayoutService extends Disposable {

  private slotWidgetMap: Map<SlotLocation, Widget> = new Map<SlotLocation, Widget>();
  static initHorRelativeSizes = [1, 3, 1];
  static initVerRelativeSizes = [3, 1];
  public horRelativeSizes = [MainLayoutService.initHorRelativeSizes];
  public verRelativeSizes = [MainLayoutService.initVerRelativeSizes];

  public resizeLayout: SplitPanel;
  public middleLayout: SplitPanel;

  constructor() {
    super();
  }

  registerSlot = (slotName: SlotLocation, widget: Widget) => {
    this.slotWidgetMap.set(slotName, widget);
  }
  unregisterSlot = (slotName: SlotLocation) => {
      this.slotWidgetMap.delete(slotName);
  }

  hideActivatorPanel = () => {
      const widget = this.slotWidgetMap.get(SlotLocation.activatorPanel);
      if (widget) {
          if (this.resizeLayout) {
            this.horRelativeSizes.push(this.resizeLayout.relativeSizes());
          }
          widget.hide();
      }
  }
  showActivatorPanel = () => {
      const widget = this.slotWidgetMap.get(SlotLocation.activatorPanel);
      if (widget) {
          widget.show();
          if (this.resizeLayout) {
            this.resizeLayout.setRelativeSizes(this.horRelativeSizes.pop() || MainLayoutService.initHorRelativeSizes);
          }
      }
  }
  toggleActivatorPanel = () => {
    const widget = this.slotWidgetMap.get(SlotLocation.activatorPanel);
    if (widget && widget.isHidden) {
       this.showActivatorPanel();
    } else {
      this.hideActivatorPanel();
    }
  }

  hideSubsidiaryPanel = () => {
      const widget = this.slotWidgetMap.get(SlotLocation.subsidiaryPanel);
      if (widget) {
          if (this.resizeLayout) {
            this.horRelativeSizes.push(this.resizeLayout.relativeSizes());
          }
          widget.hide();
      }
  }
  showSubsidiaryPanel = () => {
      const widget = this.slotWidgetMap.get(SlotLocation.subsidiaryPanel);
      if (widget) {
          widget.show();
          if (this.resizeLayout) {
            this.resizeLayout.setRelativeSizes(this.horRelativeSizes.pop() || MainLayoutService.initHorRelativeSizes);
          }
      }
  }
  toggleSubsidiaryPanel = () => {
    const widget = this.slotWidgetMap.get(SlotLocation.subsidiaryPanel);
    if (widget && widget.isHidden) {
       this.showSubsidiaryPanel();
    } else {
      this.hideSubsidiaryPanel();
    }
  }

  hideBottomPanel = () => {
      const widget = this.slotWidgetMap.get(SlotLocation.bottomPanel);
      if (widget) {
          if (this.middleLayout) {
            this.verRelativeSizes.push(this.middleLayout.relativeSizes());
          }
          widget.hide();
      }
  }
  showBottomPanel = () => {
      const widget = this.slotWidgetMap.get(SlotLocation.bottomPanel);
      if (widget) {
          widget.show();
          if (this.middleLayout) {
            this.middleLayout.setRelativeSizes(this.verRelativeSizes.pop() || MainLayoutService.initVerRelativeSizes);
          }
      }
  }
  toggleBottomPanel = () => {
    const widget = this.slotWidgetMap.get(SlotLocation.bottomPanel);
    if (widget && widget.isHidden) {
       this.showBottomPanel();
    } else {
      this.hideBottomPanel();
    }
  }

}
