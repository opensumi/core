import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';

import { IEventBus } from '@ali/ide-core-common';
import { InitedEvent } from '../common';

@Injectable()
export class MainLayoutService extends Disposable {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  constructor() {
      super();
  }
  initedLayout() {
    this.eventBus.fire(new InitedEvent());
  }
}
