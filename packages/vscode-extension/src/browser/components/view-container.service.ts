import { Injectable } from '@ali/common-di';

@Injectable()
export class ExtensionViewContianerService {
  private treeViews: Map<string, any> = new Map();

  registerViewContainer(containerId: string, containerViews: any[]) {

  }

  registerTreeView(viewId: string, treeViewWidget: any) {
    this.treeViews.set(viewId, treeViewWidget);
  }
}
