import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { TreeNode } from './tree';
import { TreeContainerNode } from './tree-node.view';
import { isOSX } from '@ali/ide-core-node';
import { SelectableTreeNode } from './tree-selection';

export interface TreeProps extends React.PropsWithChildren<any> {
  /**
   * 可渲染的树节点
   */
  readonly nodes?: TreeNode<any>[];
  /**
   * 左侧缩进（单位 px）
   * 默认缩进计算通过：leftPadding * depth
   */
  readonly leftPadding?: number;

  /**
   * 如果树组件支持多选，为`true`, 否则为 `false`
   */
  readonly multiSelect?: boolean;

  /**
   * 如果树组件支持搜索, 为`true`, 否则为 `false`
   */
  readonly search?: boolean;

  /**
   * 是否在视图激活时自动滚动
   */
  readonly scrollIfActive?: boolean;

  /**
   * 是否支持拖拽
   */
  readonly draggable?: boolean;

  /**
   * 是否选中
   */
  readonly selected?: boolean;

  /**
   * 选择事件回调
   */
  onSelect?: any;

  /**
   * 右键菜单事件回调
   */
  onContextMenu?: any;

  /**
   * 拖拽事件回调
   */
  onDragStart?: any;
  onDragEnter?: any;
  onDragOver?: any;
  onDragLeave?: any;
  onDragEnd?: any;
  onDrag?: any;
  onDrop?: any;
}

export interface NodeProps {
  /**
   * 与根节点的相对深度，根目录节点深度为 `0`, 子节点深度为 `1`，其余依次
   */
  readonly depth: number;
  /**
   * 左侧缩进（单位 px）
   * 默认缩进计算通过：leftPadding * depth
   */
  readonly leftPadding: number;
}

export const defaultTreeProps: TreeProps = {
  nodes: [],
  leftPadding: 8,
};

export const TreeContainer = observer((
  {
    nodes = defaultTreeProps.nodes,
    leftPadding = defaultTreeProps.leftPadding,
    multiSelect,
    onSelect,
    onContextMenu,
    onDragStart,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDragEnd,
    onDrag,
    onDrop,
    draggable,
  }: TreeProps,
) => {

  const contextMenuHandler = (node, event) => {
    const result: any = [];
    let contexts = [node];
    let isMenuActiveOnSelectedNode = false;
    if (!nodes) {
      return ;
    }
    for (const n of nodes as SelectableTreeNode[]) {
      if (n.selected) {
        if (node.id === n.id) {
          isMenuActiveOnSelectedNode = true;
        }
        result.push(n);
      }
    }
    // 如果右键菜单在已选中的元素触发，为多选菜单
    // 否则为单选菜单
    if (isMenuActiveOnSelectedNode) {
      contexts = result;
    }
    onContextMenu(contexts, event);
  };

  const selectRange = (nodes: any = [], node: TreeNode) => {
    const result: any[] = [];
    let from;
    let to;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].selected) {
        to = i;
      }
      if (node.id === nodes[i].id) {
        from = i;
        break;
      }
    }
    // 优先向下查找选中节点
    for (let j = from; j < nodes.length; j++) {
      if (nodes[j].selected) {
        to = j;
      }
    }
    // 返回从from到to之间节点
    if (from > to) {
      for (let h = to; h <= from; h ++) {
        result.push(nodes[h]);
      }
    } else {
      for (let n = from; n <= to; n ++) {
        result.push(nodes[n]);
      }
    }
    return result;
  };

  const toggleNode = (nodes: any = [], node: TreeNode) => {
    const result: any[] = [];
    for (const n of nodes) {
      if (node.id === n.id) {
        if (!n.selected) {
          result.push(n);
        }
      } else {
        if (n.selected) {
          result.push(n);
        }
      }
    }
    return result;
  };

  const selectNode = (node: TreeNode) => {
    return [node];
  };

  const selectHandler = (node, event) => {
    let selectedNodes: any;
    if (!node) { return; }
    // 支持多选状态时
    if (multiSelect) {
      const shiftMask = hasShiftMask(event);
      const ctrlCmdMask = hasCtrlCmdMask(event);
      if (SelectableTreeNode.is(node)) {
        if (shiftMask) {
          selectedNodes = selectRange(nodes, node);
        } else if (ctrlCmdMask) {
          selectedNodes = toggleNode(nodes, node);
        } else {
          selectedNodes = selectNode(node);
        }
      }
    } else {
      selectedNodes = selectNode(node);
    }
    onSelect(selectedNodes, event);
  };

  const hasShiftMask = (event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
        return false;
    }
    return event.shiftKey;
  };

  const hasCtrlCmdMask = (event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  };
  return  <React.Fragment>
    {
      nodes!.map(<T extends TreeNode>(node: T, index: number) => {
        return <TreeContainerNode
          node = { node }
          leftPadding = { leftPadding }
          key = { node.id }
          onSelect = { selectHandler }
          onContextMenu = { contextMenuHandler }
          onDragStart = { onDragStart }
          onDragEnter = { onDragEnter }
          onDragOver = { onDragOver }
          onDragLeave = { onDragLeave }
          onDragEnd = { onDragEnd }
          onDrag = { onDrag }
          onDrop = { onDrop }
          draggable = { draggable }
        />;
      })
    }
  </React.Fragment>;
});
