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
}
export type FileTreeNodeRenderedProps = IFileTreeNodeProps & INodeRendererProps;

export const FileTreeNode: React.FC<FileTreeNodeRenderedProps> = ({
  item,
  onClick,
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

  const isDirectory = itemType === NodeType.CompositeTreeNode;

  const isFocused = item.focused;
  const isSelected = item.selected;

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

  const renderStatusTail = (node: Directory | File) => {
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
        className={cls(
          styles.file_tree_node,
          {
            [styles.mod_focused]: isFocused,
            [styles.mod_selected]: !isFocused && isSelected,
          },
          decorations ? decorations.classlist : null,
        )}
        style={fileTreeNodeStyle}
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
