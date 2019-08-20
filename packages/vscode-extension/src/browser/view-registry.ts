import { Injectable } from '@ali/common-di';
import { TreeViewDataProviderMain } from './api/main.thread.treeview';
import { View } from '@ali/ide-core-browser/lib/layout';

@Injectable()
export class ViewRegistry {
  viewsMap: Map<string, View[]> = new Map();

  registerViews(location: string, views: View[]) {
    this.viewsMap.set(location, views);
  }
}
