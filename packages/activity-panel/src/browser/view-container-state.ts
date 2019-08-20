import { observable } from 'mobx';
import { Injectable  } from '@ali/common-di';
import { OnEvent, WithEventBus } from '@ali/ide-core-common';
import { ResizeEvent, SlotLocation } from '@ali/ide-core-browser';
import { ViewState } from '../common';

@Injectable()
export class ViewUiStateManager extends WithEventBus {
  @observable viewStateMap: Map<string, ViewState> = new Map();
  private sideViews: {[side: string]: string[]} = {
    [SlotLocation.left]: [],
    [SlotLocation.right]: [],
  };

  constructor() {
    super();
  }

  initSize(viewId: string, side) {
    this.viewStateMap.set(viewId, {width: 0, height: 0, visible: false, opened: false});
    this.sideViews[side].push(viewId);
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    const location = e.payload.slotLocation;
    if (location === SlotLocation.left || location === SlotLocation.right) {
      for (const viewId of this.sideViews[location]) {
        const viewState = this.viewStateMap.get(viewId)!;
        viewState.width = e.payload.width;
      }
    }
  }

  updateOpened(viewId: string, opened: boolean) {
    const viewState = this.viewStateMap.get(viewId)!;
    viewState.opened = opened;
  }

  updateSize(viewId: string, height: number) {
    const viewState = this.viewStateMap.get(viewId)!;
    viewState.height = height;
  }
}
