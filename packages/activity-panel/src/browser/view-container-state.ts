import { observable } from 'mobx';
import { Injectable  } from '@ali/common-di';
import { SlotLocation, Disposable } from '@ali/ide-core-browser';
import { ViewState } from '../common';

@Injectable()
export class ViewUiStateManager extends Disposable {
  @observable viewStateMap: Map<string, ViewState> = new Map();
  private sideViews: {[side: string]: string[]} = {
    [SlotLocation.left]: [],
    [SlotLocation.right]: [],
    [SlotLocation.bottom]: [],
  };

  constructor() {
    super();
  }

  initSize(viewId: string, side) {
    this.viewStateMap.set(viewId, {width: 0, height: 0});
    this.sideViews[side].push(viewId);
  }

  updateSize(viewId: string, height: number, width?: number) {
    const viewState = this.viewStateMap.get(viewId)!;
    viewState.height = height;
    if (width) {
      viewState.width = width;
    }
  }

  getState(viewId: string) {
    return this.viewStateMap.get(viewId);
  }

  removeState(viewId: string) {
    this.viewStateMap.delete(viewId);
  }
}
