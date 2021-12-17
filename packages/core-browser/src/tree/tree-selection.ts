import { TreeNode } from './tree';

/**
 * 树选中状态标示
 */
export interface TreeSelection {
  /**
   * 可选中的节点
   */
  readonly node: Readonly<SelectableTreeNode>;

  /**
   * 可选的选中类型，默认值为 `SelectionType.DEFAULT`;
   */
  readonly type?: TreeSelection.SelectionType;
}

export namespace TreeSelection {
  /**
   * 选择状态
   */
  export enum SelectionType {
    DEFAULT,
    TOGGLE,
    RANGE,
  }

  export function is(arg: object | undefined): arg is TreeSelection {
    return !!arg && 'node' in arg;
  }

  export function isRange(arg: TreeSelection | SelectionType | undefined): boolean {
    return isSelectionTypeOf(arg, SelectionType.RANGE);
  }

  export function isToggle(arg: TreeSelection | SelectionType | undefined): boolean {
    return isSelectionTypeOf(arg, SelectionType.TOGGLE);
  }

  function isSelectionTypeOf(arg: TreeSelection | SelectionType | undefined, expected: SelectionType): boolean {
    if (arg === undefined) {
      return false;
    }
    const type = typeof arg === 'number' ? arg : arg.type;
    return type === expected;
  }
}

/**
 * 可选中的树节点
 */
export interface SelectableTreeNode extends TreeNode {
  /**
   * 是否选择
   */
  selected: boolean;

  /**
   * 是否为焦点
   */
  focused?: boolean;
}

export namespace SelectableTreeNode {
  export function is(node: TreeNode | undefined): node is SelectableTreeNode {
    return !!node && 'selected' in node;
  }

  export function isSelected(node: TreeNode | undefined): node is SelectableTreeNode {
    return is(node) && node.selected;
  }

  export function hasFocus(node: TreeNode | undefined): boolean {
    return is(node) && node.focused === true;
  }

  export function isVisible(node: TreeNode | undefined): node is SelectableTreeNode {
    return is(node) && TreeNode.isVisible(node);
  }

  export function getVisibleParent(node: TreeNode | undefined): SelectableTreeNode | undefined {
    if (node) {
      if (isVisible(node.parent)) {
        return node.parent;
      }
      return getVisibleParent(node.parent);
    }
  }
}
