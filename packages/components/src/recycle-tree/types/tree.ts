import { MaybePromise } from '@opensumi/ide-utils';

import { CompositeTreeNode } from '../tree/TreeNode';

import { ICompositeTreeNode, ITreeNodeOrCompositeTreeNode } from './tree-node';

export interface ITree {
  // 加载子节点函数
  resolveChildren: (parent?: ICompositeTreeNode) => MaybePromise<ITreeNodeOrCompositeTreeNode[] | null>;
  // 节点排序函数
  sortComparator?: (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => number;
  // 根节点
  root?: CompositeTreeNode;
}
