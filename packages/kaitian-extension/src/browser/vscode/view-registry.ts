import { Injectable } from '@ali/common-di';
import { View, ViewContainerOptions } from '@ali/ide-core-browser/lib/layout';

@Injectable()
export class ViewRegistry {
  viewsMap: Map<string, View[]> = new Map();
  containerMap: Map<string, ViewContainerOptions> = new Map();

  registerViews(containerId: string, views: View[]) {
    this.viewsMap.set(containerId, views);
  }

  registerContainer(containerId: string, containerOption: ViewContainerOptions) {
    this.containerMap.set(containerId, containerOption);
  }
}
