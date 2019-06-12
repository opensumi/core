
import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './tree.module.less';
import * as cls from 'classnames';
import { TreeNode } from './tree';
import { ExpandableTreeNode } from './tree-expansion';
import { SelectableTreeNode } from './tree-selection';

export interface TreeNodeProps extends React.PropsWithChildren<any> {
  node: TreeNode;
  leftPadding?: number;
  onSelect?: any;
  onContextMenu?: any;
  onDragStart?: any;
  onDragEnter?: any;
  onDragOver?: any;
  onDragLeave?: any;
  onDrag?: any;
}

const renderIcon = (node: TreeNode) => {
  return <div className={ cls(node.icon, styles.kt_file_icon) }></div>;
};

const renderDisplayName = (node: TreeNode) => {
  return <div
            className={ cls(styles.kt_treenode_segment, styles.kt_treenode_segment_grow) }
          >
            { node.name }
          </div>;
};

const renderStatusTail = (node: TreeNode) => {
  return <div className={ cls(styles.kt_treenode_segment, styles.kt_treeNode_tail) }></div>;
};

const renderFolderToggle = <T extends ExpandableTreeNode>(node: T) => {
  return <div
    className={ cls(
      styles.kt_treenode_segment,
      styles.kt_expansion_toggle,
      {[`${styles.kt_mod_collapsed}`]: !node.expanded},
    )}
  >
  </div>;
};

export const TreeContainerNode = observer((
  { node, leftPadding, onSelect, onContextMenu, onDragStart, onDragEnter, onDragOver, onDragLeave, onDrag }: TreeNodeProps,
) => {
  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    left: '0',
    top: `${node.order * 22}px`,
  } as React.CSSProperties;
  const FileTreeNodeStyle = {
    paddingLeft: `${10 + node.depth * (leftPadding || 0) }px`,
  } as React.CSSProperties;

  const selectHandler = (event) => {
    onSelect(node, event);
  };
  const contextMenuHandler = (event) => {
    onContextMenu(node, event);
  };
  const dragStartHandler = (event) => {
    onDragStart(node, event);
  };

  const dragEnterHandler = (event) => {
    onDragEnter(node, event);
  };

  const dragOverHandler = (event) => {
    onDragOver(node, event);
  };

  const dragLeaveHandler = (event) => {
    onDragLeave(node, event);
  };

  const dragHandler = (event) => {
    onDrag(node, event);
  };

  return (
    <div
      key={ node.id }
      style={ FileTreeNodeWrapperStyle }
      draggable={ SelectableTreeNode.is(node) }
      onDragStart={ dragStartHandler }
      onDragEnter={ dragEnterHandler }
      onDragOver={ dragOverHandler }
      onDragLeave={ dragLeaveHandler }
      onDrag={ dragHandler }
      onContextMenu={ contextMenuHandler }
      onClick={ selectHandler }
      >
      <div
        className={ cls(styles.kt_treenode, SelectableTreeNode.hasFocus(node) ? styles.kt_mod_focused : SelectableTreeNode.isSelected(node) ? styles.kt_mod_selected : '') }
        style={ FileTreeNodeStyle }
      >
        <div className={ styles.kt_treenode_content }>
          { ExpandableTreeNode.is(node) && renderFolderToggle(node) }
          { renderIcon(node) }
          { renderDisplayName(node) }
          { renderStatusTail(node) }
        </div>
      </div>
    </div>
  );
});
