import { CompositeTreeNode, TreeNode } from '../tree/TreeNode';
import { ITreeNodeOrCompositeTreeNode } from './tree-node';

export interface ITree {
  // 加载子节点函数
  resolveChildren: (parent: CompositeTreeNode) =>  Promise<(TreeNode | CompositeTreeNode)[] | null > ;
  // 节点排序函数
  sortComparator?: (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => number;
  // 根节点
  root?: CompositeTreeNode;
}
