import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { OnEvent, IEventBus } from '@ali/ide-core-node';
import { RenderedEvent } from '@ali/ide-main-layout';

@Injectable()
export class ViewContainerUiState {
  @observable width: number = 0;
  @observable height: number = 0;
  @observable rendered: boolean = false;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  constructor() {
    this.eventBus.on(RenderedEvent, () => {
      this.rendered = true;
    });
  }

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
