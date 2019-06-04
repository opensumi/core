import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './tree.module.less';
import throttle = require('lodash.throttle');
import * as cls from 'classnames';
import { TreeNode, CompositeTreeNode } from './tree';

export interface TreeProps extends React.PropsWithChildren<any> {
  /**
   * 可渲染的树节点
   */
  readonly treeNodes: TreeNode[];
  /**
   * 提供给ContextMenu用于为树组件构建右键菜单
   */
  readonly contextMenuPath?: string[];

  /**
   * 左侧缩进（单位 px）
   * 默认缩进计算通过：leftPadding * depth
   */
  readonly leftPadding: number;

  /**
   * 如果树组件支持多选，为`true`, 否则为 `false`
   */
  readonly multiSelect?: boolean;

  /**
   * 如果树组件支持搜索, 为`true`, 否则为 `false`
   */
  readonly search?: boolean;

  /**
   * 如果树组件支持树文本搜索，为`true`, 否则为 `false`
   */
  readonly virtualized?: boolean;

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

}

export interface TreeNodeProps extends React.PropsWithChildren<any> {
  node: TreeNode;
  leftPadding: number;
  onSelect?: any;
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
  treeNodes: [],
  leftPadding: 8,
};

export const TreeContainer = observer((
  { treeNodes, leftPadding, onSelect }: TreeProps,
) => {

  return  <React.Fragment>
    {
      treeNodes.map((node: TreeNode, index: number) => {
        return <TreeContainerNode
          node = { node }
          leftPadding = { leftPadding || defaultTreeProps.leftPadding }
          key = { index }
          onSelect = { onSelect }
        />;
      })
    }
  </React.Fragment>;
});

const renderIcon = (node: TreeNode) => {
  return <div className={ cls(node.icon, styles.kt_filetree_file_icon) }></div>;
};

const renderDisplayName = (node: TreeNode) => {
  return <div
            className={ cls(styles.kt_filetree_treenode_segment, styles.kt_filetree_treenode_segment_grow) }
          >
            { node.name }
          </div>;
};

const renderStatusTail = (node: TreeNode) => {
  return <div className={ cls(styles.kt_filetree_treenode_segment, styles.kt_filetree_treeNode_tail) }></div>;
};

export const TreeContainerNode = observer((
  { node, leftPadding, draggable, selected, onSelect }: TreeNodeProps,
) => {
  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    left: '0',
    top: `${node.order * 22}px`,
  } as React.CSSProperties;

  const FileTreeNodeStyle = {
    paddingLeft: `${CompositeTreeNode.is(node) ? 0 : 18 + node.depth * leftPadding }px`,
  } as React.CSSProperties;

  const selectHandler = () => {
    onSelect(node);
  };

  const handleClickThrottled = throttle(selectHandler, 200);

  const onDragStartHanlder = (event: any) => {
    if (draggable) {
      return event.dataTransfer.setData('uri', node.uri.toString());
    }
  };

  return (
    <div draggable={ draggable } onDragStart={ onDragStartHanlder }
      style={ FileTreeNodeWrapperStyle } key={ node.id }>
      <div
        className={ cls(styles.kt_filetree_treenode, {[`${styles.kt_mod_selected}`]: selected}) }
        style={ FileTreeNodeStyle }
        onClick={ handleClickThrottled }
      >
        <div className={ styles.kt_filetree_treenode_content }>
          { renderIcon(node) }
          { renderDisplayName(node) }
          { renderStatusTail(node) }
        </div>
      </div>
    </div>
  );
});
