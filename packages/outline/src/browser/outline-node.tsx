import cls from 'classnames';
import React from 'react';


import {
  TreeNode,
  CompositeTreeNode,
  INodeRendererProps,
  ClasslistComposite,
  TreeNodeType,
} from '@opensumi/ide-components';
import { URI, getIcon, CommandService } from '@opensumi/ide-core-browser';
import { SymbolTag } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';

import { IOutlineDecorationService } from '../common';

import { OutlineCompositeTreeNode, OutlineTreeNode } from './outline-node.define';
import styles from './outline-node.module.less';

export interface IOutlineNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorationService: IOutlineDecorationService;
  commandService: CommandService;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType, activeUri?: URI) => void;
  onTwistierClick: (
    ev: React.MouseEvent,
    item: TreeNode | CompositeTreeNode,
    type: TreeNodeType,
    activeUri?: URI,
  ) => void;
}

export type OutlineNodeRenderedProps = IOutlineNodeProps & INodeRendererProps;

export const OutlineNode: React.FC<OutlineNodeRenderedProps> = ({
  item,
  defaultLeftPadding = 8,
  leftPadding = 8,
  onClick,
  onTwistierClick,
  itemType,
  decorationService,
  decorations,
}: OutlineNodeRenderedProps) => {
  const decoration = OutlineTreeNode.is(item) ? decorationService.getDecoration(item) : null;

  const handleClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onClick(ev, item as OutlineTreeNode, itemType);
    }
  };

  const handlerTwistierClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      if (onTwistierClick) {
        onTwistierClick(ev, item as OutlineTreeNode, itemType);
      } else {
        onClick(ev, item as OutlineTreeNode, itemType);
      }
    }
  };

  const paddingLeft = `${
    defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + (!OutlineCompositeTreeNode.is(item) ? 16 : 0)
  }px`;

  const editorNodeStyle = {
    color: decoration ? decoration.color : '',
    height: OUTLINE_TREE_NODE_HEIGHT,
    lineHeight: `${OUTLINE_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderIcon = (node: OutlineCompositeTreeNode | OutlineTreeNode) => (
    <div
      className={cls(styles.icon, node.icon)}
      style={{ height: OUTLINE_TREE_NODE_HEIGHT, lineHeight: `${OUTLINE_TREE_NODE_HEIGHT}px` }}
    ></div>
  );

  const getName = (node: OutlineCompositeTreeNode | OutlineTreeNode) => node.displayName.replace(/\n/g, '↵');

  const renderDisplayName = (node: OutlineCompositeTreeNode | OutlineTreeNode) => (
    <div
      className={cls(styles.outline_node_segment, styles.outline_node_display_name, {
        [styles.deprecated]: node.raw.tags && node.raw.tags.indexOf(SymbolTag.Deprecated) >= 0,
      })}
    >
      {getName(node)}
    </div>
  );

  const renderStatusTail = () => (
    <div className={cls(styles.outline_node_segment, styles.outline_node_tail)}>{renderBadge()}</div>
  );

  const renderBadge = () => {
    if (!decoration) {
      return null;
    }
    return <div className={styles.outline_node_status}>{decoration.badge.slice()}</div>;
  };

  const renderFolderToggle = (node: OutlineCompositeTreeNode, clickHandler: any) => (
    <div
      onClick={clickHandler}
      className={cls(styles.file_tree_node_segment, styles.expansion_toggle, getIcon('arrow-right'), {
        [`${styles.mod_collapsed}`]: !(node as OutlineCompositeTreeNode).expanded,
      })}
    />
  );

  const renderTwice = (item) => {
    if (OutlineCompositeTreeNode.is(item)) {
      return renderFolderToggle(item, handlerTwistierClick);
    }
  };

  const getItemTooltip = () => {
    let tooltip = item.tooltip || item.name;
    if (decoration && decoration.tooltip) {
      tooltip += ` • ${decoration.tooltip}`;
    }
    return tooltip;
  };

  return (
    <div
      key={item.id}
      onClick={handleClick}
      title={getItemTooltip()}
      className={cls(styles.outline_node, decorations ? decorations.classlist : null)}
      style={editorNodeStyle}
      data-id={item.id}
    >
      <div className={cls(styles.outline_node_content)}>
        {renderTwice(item)}
        {renderIcon(item)}
        <div className={styles.outline_node_overflow_wrap}>{renderDisplayName(item)}</div>
        {renderStatusTail()}
      </div>
    </div>
  );
};

export const OUTLINE_TREE_NODE_HEIGHT = 22;
