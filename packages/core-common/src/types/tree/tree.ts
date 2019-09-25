import { URI } from '../../uri';

export interface TreeNodeHighlightRange {
  start: number;
  end: number;
}

export type themeColorId = string;
export interface IFileDecoration {
  badge: string;
  tooltip: string;
  color: themeColorId;
  weight?: number;
}
export interface FileDecorationsProvider {
  getDecoration: (uri: any, hasChildren?: boolean) => IFileDecoration
}

export interface ThemeProvider {
  getColor: ({id: themeColorId }) => string
}

export interface TreeNode<T extends TreeNode<any> = TreeNode<any>> {
  /**
   * 节点唯一ID
   */
  readonly id: number | string;
  /**
   * 可读的节点名称
   */
  readonly name: string;
  /**
   * 节点头部，会影响节点计算逻辑
   * 不适用于RecycleTree面板
   */
  readonly title?: string;
  /**
   * 节点的资源位置
   */
  readonly uri?: URI;
  /**
   * 顺序
   */
  readonly order?: number;
  /**
   * 节点深度
   */
  readonly depth?: number;
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
   * 节点尾部标志，如M，C等
   */
  readonly badge?: number | string;
  /**
   * 节点字体颜色
  */
  readonly color?: string
  /**
   * 节点尾部标志样式，如M，C等
   */
  readonly badgeStyle?: React.CSSProperties;
  /**
   * 文本提示
   */
  readonly tooltip?: string;

  /**
   * 节点上的工具栏
   */
  readonly actions?: TreeViewAction[];

  /**
   * 高亮区域
   */
  readonly highLightRange?: TreeNodeHighlightRange;

  /**
   * 高亮区域替换文本
   */
  readonly replace?: string;

  /**
   * 名称显示后部部分补充文本
   */
  readonly afterLabel?: string;

  /**
   * 名称显示前部部分补充文本
   */
  readonly beforeLabel?: string;

  /**
   * 名称显示样式
   */
  readonly labelClass?: string;

  /**
   * 描述信息样式
   */
  readonly descriptionClass?: string;

  [key: string]: any;
}

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

export interface TreeViewAction<T = any> {
  icon: {
    dark?: string;
    light?: string;
  } | string;
  title: string;
  command: string;
  location: TreeViewActionTypes;
  paramsKey?: string;
}

export enum TreeViewActionTypes {
  TreeNode_Left = 0,
  TreeNode_Right,
  TreeContainer,
}

