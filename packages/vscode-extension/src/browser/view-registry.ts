import { Injectable } from '@ali/common-di';
import { View } from '@ali/ide-activity-panel';
import { TreeViewDataProviderMain } from './api/main.thread.treeview';

@Injectable()
export class ViewRegistry {
  viewsMap: Map<string, View[]> = new Map();

  registerViews(location: string, views: View[]) {
    this.viewsMap.set(location, views);
  }
}
