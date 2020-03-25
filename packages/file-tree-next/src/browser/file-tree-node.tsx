import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './file-tree-node.module.less';
import { TreeNode, CompositeTreeNode, INodeRendererProps, ClasslistComposite, PromptHandle, TreeNodeType, RenamePromptHandle, NewPromptHandle } from '@ali/ide-components';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { getIcon, URI } from '@ali/ide-core-browser';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';
import { DragAndDropService } from './services/file-tree-dnd.service';

export interface IFileTreeNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorationService: FileTreeDecorationService;
  labelService: LabelService;
  decorations?: ClasslistComposite;
  dndService: DragAndDropService;
  onTwistieClick?: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onContextMenu: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
}

export type FileTreeNodeRenderedProps = IFileTreeNodeProps & INodeRendererProps;

export const FileTreeNode: React.FC<FileTreeNodeRenderedProps> = ({
  item,
  onClick,
  onContextMenu,
  dndService,
  itemType,
  decorationService,
  labelService,
  leftPadding = 8,
  onTwistieClick,
  decorations,
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
    const { handleDragStart } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragStart(ev, item);
    }
  };

  const handleDragEnd = (ev: React.DragEvent) => {
    const { handleDragEnd } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragEnd(ev, item);
    }
  };

  const handleDragLeave = (ev: React.DragEvent) => {
    const { handleDragLeave } = dndService;

    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragLeave(ev, item);
    }
  };

  const handleDragEnter = (ev: React.DragEvent) => {
    const { handleDragEnter } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragEnter(ev, item);
    }
  };

  const handleDrop = (ev: React.DragEvent) => {
    const { handleDrop } = dndService;

    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDrop(ev, item);
    }
  };

  const handleDragOver = (ev: React.DragEvent) => {
    const { handleDragOver } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragOver(ev, item);
    }
  };

  const isDirectory = itemType === TreeNodeType.CompositeTreeNode;

  const fileTreeNodeStyle = {
    color: decoration ? decoration.color : '',
    height: FILE_TREE_NODE_HEIGHT,
    lineHeight: `${FILE_TREE_NODE_HEIGHT}px`,
    paddingLeft: isDirectory || (isPrompt && item.type === TreeNodeType.CompositeTreeNode) ? `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0)}px` : `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + 5}px`,
  } as React.CSSProperties;

  const renderFolderToggle = (node: Directory | PromptHandle, clickHandler: any) => {
    // TODO: loading
    // if (node.isLoading) {
    //   return <Loading />;
    // }
    if (isPrompt && node instanceof PromptHandle) {
      const isDirectory: boolean = (node as NewPromptHandle).type === TreeNodeType.CompositeTreeNode;
      if (isDirectory) {
        return <div
          className={cls(
            styles.file_tree_node_segment,
            styles.expansion_toggle,
            getIcon('arrow-right'),
            styles.mod_collapsed,
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
          { [`${styles.mod_collapsed}`]: !(node as Directory).expanded },
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

  const renderDisplayName = (node: Directory | File) => {
    if (isPrompt && node instanceof PromptHandle) {
      return <div
          className={cls(styles.file_tree_node_segment, styles.file_tree_node_inputbox)}
        >
          <div className={cls('input-box', styles.file_tree_node_prompt_box)}>
            <node.ProxiedInput  wrapperStyle={{height: FILE_TREE_NODE_HEIGHT, padding: 0, textIndent: 5}}/>
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

  const renderTwice = (item) => {
    if (isDirectory) {
      return renderFolderToggle(item, handlerTwistieClick);
    } else if (isPrompt) {
      return renderFolderToggle(item, () => {});
    }
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
          {renderTwice(item)}
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
