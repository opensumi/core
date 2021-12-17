import React from 'react';

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
  getDecoration: (uri: any, hasChildren?: boolean) => IFileDecoration;
}

export interface ThemeProvider {
  getColor: ({ id: themeColorId }) => string;
}

export interface TreeNode<T extends TreeNode<any> = TreeNode<any>> {
  /**
   * 节点唯一ID
   */
  readonly id: number | string;
  /**
   * 可读的节点名称
   * 可能为ReactComponent
   */
  readonly name: string | React.JSXElementConstructor<any>;
  /**
   * 节点头部，会影响节点计算逻辑
   * 不适用于RecycleTree面板
   */
  readonly title?: string;

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
   * 图标的样式
   */
  readonly iconStyle?: React.CSSProperties;
  /**
   * 节点描述
   * 可能为ReactComponent
   */
  readonly description?: string | React.JSXElementConstructor<any>;
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
   * badge限制
   * 当badge为number时
   * badgeLimit = 99，badge最多显示为99+
   * 当badge为string时
   * badgeLimit = 2，badge最多显示不超过2个字符
   */
  readonly badgeLimit?: number;
  /**
   * 节点字体颜色
   */
  readonly color?: string;
  /**
   * 节点背景颜色
   */
  readonly background?: string;
  /**
   * 节点字体颜色样式
   */
  readonly style?: React.CSSProperties;
  /**
   * 节点尾部标志样式，如M，C等
   */
  readonly badgeStyle?: React.CSSProperties;
  /**
   * 文本提示
   */
  readonly tooltip?: string;

  /**
   * 节点上的 inline actions, 可以传自定义 react 组件
   */
  readonly actions?: TreeViewAction[];

  /**
   * 节点上 inline actions 是否一直显示，默认为 hover 出现
   */
  readonly alwaysShowActions?: boolean;

  /**
   * 高亮区域
   */
  readonly highLightRanges?: {
    name?: TreeNodeHighlightRange[];
    description?: TreeNodeHighlightRange[];
  };

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

  /**
   * 节点头部的图标样式，如，dirty状态文件的小圆点
   */
  readonly headIconClass?: string;

  /**
   * 是否为临时文件，如可编辑节点
   */
  readonly isTemporary?: boolean;
  /**
   * 仅对可折叠节点有效，控制loading样式
   */
  readonly isLoading?: boolean;

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

export function isTreeViewActionComponent(action: TreeViewAction): action is TreeViewActionComponent {
  return 'component' in action && React.isValidElement(action.component);
}

export type TreeViewAction = TreeViewActionConfig | TreeViewActionComponent;

export interface TreeViewActionConfig {
  icon:
    | {
        dark?: string;
        light?: string;
      }
    | string;
  title: string;
  command: string;
  location: TreeViewActionTypes;
  /**
   * paramsKey 支持从 node 直接取指定的 key
   * 同时也支持从 node 变换成一个新的格式
   */
  paramsKey?: string | ((node: TreeNode) => any);
}

export interface TreeViewActionComponent {
  component: React.ReactNode;
  location: TreeViewActionTypes;
}

export enum TreeViewActionTypes {
  TreeNode_Left = 0,
  TreeNode_Right,
  TreeContainer,
}
