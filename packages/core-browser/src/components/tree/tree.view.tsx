import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { TreeNode } from './tree';
import { TreeContainerNode } from './tree-node.view';

export interface TreeProps extends React.PropsWithChildren<any> {
  /**
   * 可渲染的树节点
   */
  readonly nodes: TreeNode<any>[];
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
  { nodes, leftPadding, onSelect, onContextMenu, onDragStart }: TreeProps,
) => {
  return  <React.Fragment>
    {
      nodes.map(<T extends TreeNode>(node: T, index: number) => {
        return <TreeContainerNode
          node = { node }
          leftPadding = { leftPadding || defaultTreeProps.leftPadding }
          key = { node.id }
          onSelect = { onSelect }
          onContextMenu = { onContextMenu }
          onDragStart = { onDragStart }
        />;
      })
    }
  </React.Fragment>;
});
