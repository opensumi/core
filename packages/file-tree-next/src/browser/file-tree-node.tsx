import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './file-tree-node.module.less';
import { TreeNode, CompositeTreeNode, NodeType, INodeRendererProps, ClasslistComposite } from '@ali/ide-components';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { getIcon } from '@ali/ide-core-browser';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';

export interface IFileTreeNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorationService: FileTreeDecorationService;
  labelService: LabelService;
  decorations?: ClasslistComposite;
  onTwistieClick?: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onContextMenu: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onDragStart: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onDragEnter: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onDragEnd: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onDrop: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onDragOver: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
  onDragLeave: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
}

export type FileTreeNodeRenderedProps = IFileTreeNodeProps & INodeRendererProps;

export const FileTreeNode: React.FC<FileTreeNodeRenderedProps> = ({
  item,
  onClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  itemType,
  decorationService,
  labelService,
  leftPadding = 8,
  onTwistieClick,
  decorations,
  defaultLeftPadding = 8,
}: FileTreeNodeRenderedProps) => {
  const decoration = decorationService.getDecoration(item.uri, Directory.is(item));
  const handleClick = (ev: React.MouseEvent) => {
    if (itemType === NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onClick(ev, item as File, itemType);
    }
  };

  const handlerTwistieClick = (ev: React.MouseEvent) => {
    if (itemType === NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      if (onTwistieClick) {
        onTwistieClick(ev, item as File, itemType);
      } else {
        onClick(ev, item as File, itemType);
      }
    }
  };

  const handleContextMenu = (ev: React.MouseEvent) => {
    if (ev.nativeEvent.which === 0) {
        return;
    }
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
        onContextMenu(ev, item as TreeNode, itemType);
    }
  };

  const handleDragStart = (ev: React.DragEvent) => {
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onDragStart(ev, item as TreeNode, itemType);
    }
  };

  const handleDragEnd = (ev: React.DragEvent) => {
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onDragEnd(ev, item as TreeNode, itemType);
    }
  };

  const handleDragLeave = (ev: React.DragEvent) => {
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onDragLeave(ev, item as TreeNode, itemType);
    }
  };

  const handleDragEnter = (ev: React.DragEvent) => {
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onDragEnter(ev, item as TreeNode, itemType);
    }
  };

  const handleDrop = (ev: React.DragEvent) => {
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onDrop(ev, item as TreeNode, itemType);
    }
  };

  const handleDragOver = (ev: React.DragEvent) => {
    if (itemType ===  NodeType.TreeNode || itemType === NodeType.CompositeTreeNode) {
      onDragOver(ev, item as TreeNode, itemType);
    }
  };

  const isDirectory = itemType === NodeType.CompositeTreeNode;

  const fileTreeNodeStyle = {
    color: decoration ? decoration.color : '',
    height: FILE_TREE_NODE_HEIGHT,
    lineHeight: `${FILE_TREE_NODE_HEIGHT}px`,
    paddingLeft: isDirectory ? `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0)}px` : `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + 5}px`,
  } as React.CSSProperties;

  const renderFolderToggle = (node: Directory, clickHandler: any) => {
    // TODO: loading
    // if (node.isLoading) {
    //   return <Loading />;
    // }
    return <div
      onClick={clickHandler}
      className={cls(
        styles.file_tree_node_segment,
        styles.expansion_toggle,
        getIcon('arrow-right'),
        { [`${styles.mod_collapsed}`]: !node.expanded },
      )}
    />;
  };

  const renderIcon = (node: Directory | File) => {
    const iconClass = labelService.getIcon(node.uri, {isDirectory: node.filestat.isDirectory});
    return <div className={cls(styles.file_icon, iconClass, {expanded: isDirectory && (node as Directory).expanded})} style={{ height: FILE_TREE_NODE_HEIGHT, lineHeight: `${FILE_TREE_NODE_HEIGHT}px`}}>
    </div>;
  };

  const renderDisplayName = (node: Directory | File) => {
    return <div
        className={cls(styles.file_tree_node_segment, styles.file_tree_node_displayname)}
      >
        {node.name}
      </div>;
  };

  const renderStatusTail = () => {
    return <div className={cls(styles.file_tree_node_segment, styles.file_tree_node_tail)}>
      {renderBadge()}
    </div>;
  };

  const renderBadge = () => {
    if (!decoration) {
      return null;
    }
    return <div className={styles.file_tree_node_status}>
      {decoration.badge.slice()}
    </div>;
  };

  return (
    <div
        key={item.id}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cls(
          styles.file_tree_node,
          decorations ? decorations.classlist : null,
        )}
        style={fileTreeNodeStyle}
        draggable={itemType === NodeType.TreeNode || itemType === NodeType.CompositeTreeNode}
      >
        <div className={cls(styles.file_tree_node_content)}>
          {(isDirectory && renderFolderToggle(item, handlerTwistieClick))}
          {renderIcon(item)}
          <div
            className={styles.file_tree_node_overflow_wrap}
          >
            {renderDisplayName(item)}
          </div>
          {renderStatusTail(item)}
        </div>
      </div>
  );
};

export const FILE_TREE_NODE_HEIGHT = 22;
export const FILE_TREE_BADGE_LIMIT = 99;
