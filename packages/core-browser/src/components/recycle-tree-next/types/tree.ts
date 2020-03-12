import { CompositeTreeNode } from '../tree-node';
import { ITreeNodeOrCompositeTreeNode } from './tree-node';

export interface ITree {
  // 加载子节点函数
  resolveChildren: (parent: CompositeTreeNode) =>  Promise<ITreeNodeOrCompositeTreeNode[] | null > ;
  // 节点排序函数
  sortComparator?: (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => number;
}
