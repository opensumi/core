import { CompositeTreeNode } from './';

/**
 * 可折叠的树节点
 */
export interface ExpandableTreeNode extends CompositeTreeNode {
  /**
   * 该节点是否可折叠，是则为true，否则为false
   */
  expanded: boolean;
}

export namespace ExpandableTreeNode {
  export function is(node: object | undefined): node is ExpandableTreeNode {
    return !!node && CompositeTreeNode.is(node) && 'expanded' in node;
  }

  export function isExpanded(node: object | undefined): node is ExpandableTreeNode {
    return ExpandableTreeNode.is(node) && node.expanded;
  }

  export function isCollapsed(node: object | undefined): node is ExpandableTreeNode {
    return ExpandableTreeNode.is(node) && !node.expanded;
  }
}
