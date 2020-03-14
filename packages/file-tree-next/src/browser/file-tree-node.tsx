import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './file-tree.module.less';
import { TreeNode, CompositeTreeNode, RenamePromptHandle, NodeType, INodeRendererProps, PromptHandle } from '@ali/ide-components';

export interface IFileTreeNodeProps {
  item: any;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: NodeType) => void;
}
export type FileTreeNodeRenderedProps = IFileTreeNodeProps & INodeRendererProps;

export const FileTreeNode: React.FC<FileTreeNodeRenderedProps> = ({
  onClick,
  item,
  itemType,
}: FileTreeNodeRenderedProps) => {

  const isRenamePrompt = itemType === NodeType.RenamePrompt;
  const isNewPrompt = itemType === NodeType.NewPrompt;
  const isPrompt = isRenamePrompt || isNewPrompt;
  const isDirExpanded = itemType === NodeType.CompositeTreeNode
    ? (item as CompositeTreeNode).expanded
    : itemType === NodeType.RenamePrompt && CompositeTreeNode.is((item as RenamePromptHandle).target)
      ? ((item as RenamePromptHandle).target as CompositeTreeNode).expanded
      : false;

  const fileOrDir =
    (itemType === NodeType.TreeNode ||
      itemType === NodeType.NewPrompt ||
      (itemType === NodeType.RenamePrompt && !CompositeTreeNode.is((item as RenamePromptHandle).target)))
      ? 'file'
      : 'directory';

  return (
    <div
      className={cls(styles.tree_node, {
        renaming: isRenamePrompt,
        prompt: isRenamePrompt || isNewPrompt,
        new: isNewPrompt,
      }, fileOrDir, `depth-${item.depth}`)}
      data-depth={item.depth}
      draggable={true}
      >
      {!isNewPrompt && fileOrDir === 'directory' ?
        <i className={cls('directory-toggle', isDirExpanded ? 'open' : '')} />
        : null
      }
      <span className='file-label'>
        <i className={cls('file-icon', isNewPrompt ? 'new' : '', fileOrDir)} />
        <span className='file-name'>
          {isPrompt && item instanceof PromptHandle
            ? <><item.ProxiedInput /><span className='prompt-err-msg'></span></>
            : (item as TreeNode).name
          }
        </span>
      </span>
    </div>);
};

export const FILE_TREE_NODE_HEIGHT = 22;
