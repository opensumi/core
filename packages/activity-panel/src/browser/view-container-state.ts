import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { OnEvent, IEventBus } from '@ali/ide-core-node';
import { RenderedEvent } from '@ali/ide-main-layout';

export interface ViewState {
  width: number;
  height: number;
}

@Injectable()
export class ViewUiStateManager {
  @observable viewStateMap: Map<string | number, ViewState> = new Map();
  rendered: boolean = false;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  constructor() {
    this.eventBus.on(RenderedEvent, () => {
      this.rendered = true;
    });
  }

  initSize(viewId: number | string) {
    this.viewStateMap.set(viewId, {width: 0, height: 0});
  }

  updateSize(viewId: number | string, width: number, height: number) {
    const viewState = this.viewStateMap.get(viewId)!;
    viewState.height = height;
    viewState.width = width;
  }
}
