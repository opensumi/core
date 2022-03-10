import { CompositeTreeNode } from '../tree/TreeNode';

import { ITreeNodeOrCompositeTreeNode, ICompositeTreeNode } from './tree-node';

export interface ITree {
  // 加载子节点函数
  resolveChildren: (parent?: ICompositeTreeNode) => Promise<ITreeNodeOrCompositeTreeNode[] | null>;
  // 节点排序函数
  sortComparator?: (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => number;
  // 根节点
  root?: CompositeTreeNode;
}
