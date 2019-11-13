import { WithEventBus } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, action } from 'mobx';

@Injectable()
export class TabbarServiceManager {
  services: Map<string, TabbarService> = new Map();

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  getService(side: string) {
    const service = this.services.get(side) || this.injector.get(TabbarService);
    if (!this.services.get(side)) {
      this.services.set(side, service);
    }
    return service;
  }
}

@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  @action.bound handleTabClick(e: React.MouseEvent, setSize: (size: number, side: string) => void) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId) {
      this.currentContainerId = '';
      setSize(50, 'right');
    } else {
      this.currentContainerId = containerId;
      // FIXME 上次状态存储，视情况调用
      setSize(400, 'right');
    }
  }

}
