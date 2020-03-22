import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './file-tree-node.module.less';
import { TreeNode, CompositeTreeNode, INodeRendererProps, ClasslistComposite, PromptHandle, TreeNodeType, ValidateMessage, VALIDATE_TYPE, RenamePromptHandle } from '@ali/ide-components';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { getIcon, URI } from '@ali/ide-core-browser';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';

export interface IFileTreeNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorationService: FileTreeDecorationService;
  labelService: LabelService;
  decorations?: ClasslistComposite;
  validateMessage?: ValidateMessage;
  onTwistieClick?: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onContextMenu: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onDragStart: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onDragEnter: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onDragEnd: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onDrop: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onDragOver: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onDragLeave: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
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
  validateMessage,
  defaultLeftPadding = 8,
}: FileTreeNodeRenderedProps) => {
  const isRenamePrompt = itemType === TreeNodeType.RenamePrompt;
  const isNewPrompt = itemType === TreeNodeType.NewPrompt;
  const isPrompt = isRenamePrompt || isNewPrompt;

  const decoration = isPrompt ? null : decorationService.getDecoration(item.uri, Directory.is(item));
  const handleClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onClick(ev, item as File, itemType);
    }
  };

  const handlerTwistieClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
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
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
        onContextMenu(ev, item as TreeNode, itemType);
    }
  };

  const handleDragStart = (ev: React.DragEvent) => {
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onDragStart(ev, item as TreeNode, itemType);
    }
  };

  const handleDragEnd = (ev: React.DragEvent) => {
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onDragEnd(ev, item as TreeNode, itemType);
    }
  };

  const handleDragLeave = (ev: React.DragEvent) => {
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onDragLeave(ev, item as TreeNode, itemType);
    }
  };

  const handleDragEnter = (ev: React.DragEvent) => {
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onDragEnter(ev, item as TreeNode, itemType);
    }
  };

  const handleDrop = (ev: React.DragEvent) => {
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onDrop(ev, item as TreeNode, itemType);
    }
  };

  const handleDragOver = (ev: React.DragEvent) => {
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onDragOver(ev, item as TreeNode, itemType);
    }
  };

  const isDirectory = itemType === TreeNodeType.CompositeTreeNode;

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
    if (isPrompt && node instanceof PromptHandle) {
      const isDirectory: boolean = node.type === TreeNodeType.CompositeTreeNode;
      if (isDirectory) {
        return <div
          className={cls(
            styles.file_tree_node_segment,
            styles.expansion_toggle,
            getIcon('arrow-right'),
          )}
        />;
      }
    } else {
      return <div
        onClick={clickHandler}
        className={cls(
          styles.file_tree_node_segment,
          styles.expansion_toggle,
          getIcon('arrow-right'),
          { [`${styles.mod_collapsed}`]: !node.expanded },
        )}
      />;
    }

  };

  const renderIcon = (node: Directory | File) => {
    let nodeUri: URI;
    let isDirectory: boolean;
    if (isPrompt && node instanceof PromptHandle) {
      if (node instanceof RenamePromptHandle) {
        nodeUri = (node.target! as (File | Directory)).uri.resolve(node.$.value);
        isDirectory = Directory.is(node.target);
      } else {
        nodeUri = (node.parent! as Directory).uri.resolve(node.$.value);
        isDirectory = node.type === TreeNodeType.CompositeTreeNode;
      }
    } else {
      nodeUri = node.uri;
      isDirectory = node.filestat.isDirectory;
    }
    const iconClass = labelService.getIcon(nodeUri, {isDirectory});
    return <div className={cls(styles.file_icon, iconClass, {expanded: isDirectory && (node as Directory).expanded})} style={{ height: FILE_TREE_NODE_HEIGHT, lineHeight: `${FILE_TREE_NODE_HEIGHT}px`}}>
    </div>;
  };

  const renderValidateMessage = () => {
    const validateClx = cls({
      'validate-error': validateMessage && validateMessage.type === VALIDATE_TYPE.ERROR,
      'validate-warning': validateMessage && validateMessage.type === VALIDATE_TYPE.WARNING,
      'validate-info': validateMessage && validateMessage.type === VALIDATE_TYPE.INFO,
    });
    if (validateMessage && validateMessage.message) {
      return <div className={cls('validate-message', validateClx, 'popup')}>
        {validateMessage.message}
      </div>;
    }
  };

  const renderDisplayName = (node: Directory | File) => {
    if (isPrompt && node instanceof PromptHandle) {
      return <div
          className={cls(styles.file_tree_node_segment, styles.file_tree_node_inputbox)}
        >
          <div className='input-box'>
            <node.ProxiedInput style={{height: FILE_TREE_NODE_HEIGHT}}/>
            {renderValidateMessage()}
          </div>
        </div>;
    }
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
        draggable={itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode}
      >
        <div className={cls(styles.file_tree_node_content)}>
          {(isDirectory && renderFolderToggle(item, handlerTwistieClick))}
          {renderIcon(item)}
          <div
            className={isPrompt ? styles.file_tree_node_prompt_wrap : styles.file_tree_node_overflow_wrap}
          >
            {renderDisplayName(item)}
          </div>
          {renderStatusTail()}
        </div>
      </div>
  );
};

export const FILE_TREE_NODE_HEIGHT = 22;
export const FILE_TREE_BADGE_LIMIT = 99;
