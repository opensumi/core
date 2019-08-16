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
  viewStateMap: Map<string | number, ViewState> = new Map();
  rendered: boolean = false;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  constructor() {
    this.eventBus.on(RenderedEvent, () => {
      this.rendered = true;
    });
  }

  updateSize(viewId: number | string, width: number, height: number) {
    this.viewStateMap.set(viewId, {width, height});
  }
}
