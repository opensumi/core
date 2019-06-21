
import * as React from 'react';
import * as styles from './tree.module.less';
import * as cls from 'classnames';
import { TreeNode } from './tree';
import { ExpandableTreeNode } from './tree-expansion';
import { SelectableTreeNode } from './tree-selection';
import { TEMP_FILE_NAME } from './tree.view';

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
  draggable?: boolean;
  editable?: boolean;
}

const renderIcon = (node: TreeNode) => {
  return <div className={ cls(node.icon, styles.kt_file_icon) }></div>;
};

const renderDisplayName = (node: TreeNode, updateHandler: any) => {

  const [value, setValue] = React.useState(node.uri.displayName === TEMP_FILE_NAME ? '' : node.uri.displayName);

  const changeHandler = (event) => {
    setValue(event.target.value);
  };

  const blurHandler = (event) => {
    updateHandler(node, value);
  };

  const keydownHandler = (event: React.KeyboardEvent) => {
    if (event.keyCode === 13) {
      event.stopPropagation();
      event.preventDefault();
      updateHandler(node, value);
    }
  };

  if (node.filestat.isTemporaryFile) {
    return <div
      className={ cls(styles.kt_treenode_segment, styles.kt_treenode_segment_grow) }
    >
      <div className={ styles.kt_input_wrapper }>
        <input
          type='text'
          className={ styles.kt_input_box }
          autoFocus={ true }
          onBlur = { blurHandler }
          value = { value }
          onChange = { changeHandler}
          onKeyDown = { keydownHandler }
          />
      </div>
    </div>;
  }
  return <div
    className={ cls(styles.kt_treenode_segment, styles.kt_treenode_segment_grow) }
  >
    {node.name}
  </div>;
};

const renderStatusTail = (node: any) => {
  const content = node.filestat.isSymbolicLink ? '⤷' : '';
  return <div className={ cls(styles.kt_treenode_segment, styles.kt_treeNode_tail) }>{content}</div>;
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

export const TreeContainerNode = (
  {
    node,
    leftPadding,
    onSelect,
    onContextMenu,
    onDragStart,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDragEnd,
    onDrag,
    onDrop,
    onChange,
    draggable,
    editable,
  }: TreeNodeProps,
) => {
  const FileTreeNodeWrapperStyle = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    left: '0',
    opacity: editable && !node.filestat.isTemporaryFile ? .3 : 1,
    top: `${node.order * 22}px`,
  } as React.CSSProperties;
  const FileTreeNodeStyle = {
    paddingLeft: `${10 + node.depth * (leftPadding || 0) }px`,
  } as React.CSSProperties;

  const selectHandler = (event: React.MouseEvent) => {
    if (editable) {
      event.stopPropagation();
      event.preventDefault();
      return ;
    }
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

  const dragEndHandler = (event) => {
    onDragEnd(node, event);
  };

  const dragHandler = (event) => {
    onDrag(node, event);
  };

  const dropHandler = (event) => {
    onDrop(node, event);
  };

  const getNodeTooltip = (node: TreeNode): string | undefined => {
    const uri = node.uri.toString();
    return uri ? uri : undefined;
  };

  return (
    <div
      key={ node.id }
      style={ FileTreeNodeWrapperStyle }
      title = { getNodeTooltip(node) }
      draggable={ draggable }
      onDragStart={ dragStartHandler }
      onDragEnter={ dragEnterHandler }
      onDragOver={ dragOverHandler }
      onDragLeave={ dragLeaveHandler }
      onDragEnd={ dragEndHandler }
      onDrag={ dragHandler }
      onDrop={ dropHandler }
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
          { renderDisplayName(node, onChange) }
          { renderStatusTail(node) }
        </div>
      </div>
    </div>
  );
};
