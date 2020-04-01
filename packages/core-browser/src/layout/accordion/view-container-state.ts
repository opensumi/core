import { observable } from 'mobx';
import { Injectable  } from '@ali/common-di';
import { Disposable } from '../..';
import { ViewState } from '../';

@Injectable()
export class ViewUiStateManager extends Disposable {
  @observable viewStateMap: Map<string, ViewState> = new Map();

  constructor() {
    super();
  }

  updateSize(viewId: string, height = 0, width = 0) {
    const viewState = this.viewStateMap.get(viewId)!;
    if (!viewState) {
      this.viewStateMap.set(viewId, {width, height});
      return;
    }
    if (height) {
      viewState.height = height;
    }
    if (width) {
      viewState.width = width;
    }
  }

  getState(viewId: string) {
    const viewState = this.viewStateMap.get(viewId)!;
    if (!viewState) {
      this.viewStateMap.set(viewId, {width: 0, height: 0});
      return this.viewStateMap.get(viewId)!;
    }
    return viewState;
  }

  removeState(viewId: string) {
    this.viewStateMap.delete(viewId);
  }
}
