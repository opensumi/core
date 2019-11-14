import { WithEventBus, ComponentRegistryInfo } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, action } from 'mobx';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');

@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  @observable.shallow containersMap: Map<string, ComponentRegistryInfo> = new Map();

  constructor(public location: string) {
    super();
  }

  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    this.containersMap.set(containerId, componentInfo);
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
  }

  @action.bound handleTabClick(e: React.MouseEvent, setSize: (size: number, side: string) => void) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId) {
      this.currentContainerId = '';
      setSize(50, this.location);
    } else {
      this.currentContainerId = containerId;
      // FIXME 上次状态存储，视情况调用
      setSize(400, this.location);
    }
  }

}
