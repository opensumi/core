import { URI } from '@ali/ide-core-common';

export interface TreeNode<T extends TreeNode<any> = CompositeTreeNode> {
  /**
   * 节点唯一ID
   */
  readonly id: number | string;
  /**
   * 节点的资源位置
   */
  readonly uri: URI;
  /**
   * 可读的节点名称
   */
  readonly name: string;
  /**
   * 顺序
   */
  readonly order: number;
  /**
   * 节点深度
   */
  readonly depth: number;
  /**
   * 图标的classname
   */
  readonly icon?: string;
  /**
   * 节点描述
   */
  readonly description?: string;
  /**
   * 当该值为false时节点不渲染，否则渲染
   */
  readonly visible?: boolean;
  /**
   * 节点的父节点，当节点为根节点时为undefined
   */
  readonly parent: Readonly<T> | undefined;
  /**
   * 节点的上一节点
   */
  readonly previousSibling?: TreeNode;
  /**
   * 节点的下一节点
   */
  readonly nextSibling?: TreeNode;
}

// tslint:disable-next-line: no-namespace
export namespace TreeNode {
  export function equals(left: TreeNode | undefined, right: TreeNode | undefined): boolean {
      return left === right || (!!left && !!right && left.id === right.id);
  }

  export function isVisible(node: TreeNode | undefined): boolean {
      return !!node && (node.visible === undefined || node.visible);
  }
}

/**
 * 拓展树节点.
 */
export interface CompositeTreeNode extends TreeNode {
  /**
   * 树的子节点数组.
   */
  children: ReadonlyArray<TreeNode>;
  /**
   * 该节点是否可折叠，是则为true，否则为false
   */
  expanded?: boolean;
}

export namespace CompositeTreeNode {
  export function is(node: object | undefined): node is CompositeTreeNode {
      return !!node && 'children' in node;
  }

  export function getFirstChild(parent: CompositeTreeNode): TreeNode | undefined {
      return parent.children[0];
  }

  export function getLastChild(parent: CompositeTreeNode): TreeNode | undefined {
      return parent.children[parent.children.length - 1];
  }

  export function isAncestor(parent: CompositeTreeNode, child: TreeNode | undefined): boolean {
      if (!child) {
          return false;
      }
      if (TreeNode.equals(parent, child.parent)) {
          return true;
      }
      return isAncestor(parent, child.parent);
  }

  export function indexOf(parent: CompositeTreeNode, node: TreeNode | undefined): number {
      if (!node) {
          return -1;
      }
      return parent.children.findIndex((child) => TreeNode.equals(node, child));
  }

  export function addChildren(parent: CompositeTreeNode, children: TreeNode[]): CompositeTreeNode {
      for (const child of children) {
          addChild(parent, child);
      }
      return parent;
  }

  export function addChild(parent: CompositeTreeNode, child: TreeNode): CompositeTreeNode {
      const children = parent.children as TreeNode[];
      const index = children.findIndex((value) => value.id === child.id);
      if (index !== -1) {
          children.splice(index, 1, child);
          setParent(child, index, parent);
      } else {
          children.push(child);
          setParent(child, parent.children.length - 1, parent);
      }
      return parent;
  }

  export function removeChild(parent: CompositeTreeNode, child: TreeNode): void {
      const children = parent.children as TreeNode[];
      const index = children.findIndex((value) => value.id === child.id);
      if (index === -1) {
          return;
      }
      children.splice(index, 1);
      const { previousSibling, nextSibling } = child;
      if (previousSibling) {
          Object.assign(previousSibling, { nextSibling });
      }
      if (nextSibling) {
          Object.assign(nextSibling, { previousSibling });
      }
  }

  export function setParent(child: TreeNode, index: number, parent: CompositeTreeNode): void {
      const previousSibling = parent.children[index - 1];
      const nextSibling = parent.children[index + 1];
      Object.assign(child, { parent, previousSibling, nextSibling });
      if (previousSibling) {
          Object.assign(previousSibling, { nextSibling: child });
      }
      if (nextSibling) {
          Object.assign(nextSibling, { previousSibling: child });
      }
  }
}
