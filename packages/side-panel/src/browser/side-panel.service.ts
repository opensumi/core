import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SidePanelHandler } from './side-panel-handler';
import { SidePanelRegistry, Side } from './side-panel-registry';
import { Widget } from '@phosphor/widgets';
import { WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { ResizeEvent } from '@ali/ide-main-layout/lib/browser/ide-widget.view';
import { SlotLocation } from '@ali/ide-main-layout';
import { observable } from 'mobx';

@Injectable()
export class SidePanelService extends WithEventBus {

  @Autowired()
  sidePanelRegistry: SidePanelRegistry;

  @observable
  layout: any = {
    width: 300,
    height: 100,
  };

  initialize(container: HTMLElement, side: Side) {
    this.sidePanelRegistry.renderComponents(side, container);
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === SlotLocation.leftPanel) {
      this.layout = e.payload;
    }
  }

}
