
import { Injectable } from '@ali/common-di';
import { TreeNode } from '@ali/ide-core-node';

export interface IExtensionTreeViewModel {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
  updated?: boolean;
}

@Injectable()
export class ExtensionTreeViewModel {
  private model: Map<string, Map<string | number, IExtensionTreeViewModel>> = new Map();
  private defaultNodes: Map<string, TreeNode<any>[]> = new Map();

  getTreeViewModel(id: string): Map<string | number, IExtensionTreeViewModel> {
    if (!this.model.has(id)) {
      this.model.set(id, new Map());
    }
    return this.model.get(id)!;
  }

  setTreeViewModel(id: string, map: Map<string | number, IExtensionTreeViewModel>) {
    this.model.set(id, map);
  }

  getTreeViewNodes(id: string): TreeNode<any>[] {
    return this.defaultNodes.get(id)!;
  }

  setTreeViewNodes(id: string, nodes: TreeNode<any>[]) {
    this.defaultNodes.set(id, nodes);
  }
}
