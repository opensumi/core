import { Injectable } from '@ali/common-di';
import { TreeNode } from '@ali/ide-core-browser';

export interface IExtensionTreeNodeModel {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
  updated?: boolean;
}

@Injectable()
export class ExtensionTreeViewModel {

  cache: Map<any, TreeNode<any>[]> = new Map();
  model: Map<any, IExtensionTreeNodeModel> = new Map();

}
