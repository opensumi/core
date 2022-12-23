import cls from 'classnames';
import React, { useCallback } from 'react';

import { INodeRendererProps, ClasslistComposite } from '@opensumi/ide-components';
import { getIcon } from '@opensumi/ide-core-browser';

import { CommentContentNode, CommentFileNode, CommentReplyNode } from './tree-node.defined';
import styles from './tree-node.module.less';

export interface ICommentNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorations?: ClasslistComposite;
  onClick: (ev: React.MouseEvent, item: CommentContentNode | CommentFileNode) => void;
}

export type ICommentNodeRenderedProps = ICommentNodeProps & INodeRendererProps;

export const CommentNodeRendered: React.FC<ICommentNodeRenderedProps> = ({
  item,
  defaultLeftPadding = 8,
  leftPadding = 8,
  decorations,
  onClick,
}: ICommentNodeRenderedProps) => {
  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      onClick(ev, item as CommentContentNode);
    },
    [onClick],
  );

  const paddingLeft = `${
    defaultLeftPadding +
    (item.depth || 0) * (leftPadding || 0) +
    (CommentContentNode.is(item) ? 16 : CommentReplyNode.is(item) ? 28 : 0)
  }px`;

  const renderedNodeStyle = {
    height: COMMENT_TREE_NODE_HEIGHT,
    lineHeight: `${COMMENT_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderIcon = useCallback((node: CommentFileNode | CommentContentNode | CommentReplyNode) => {
    if (CommentReplyNode.is(node)) {
      return null;
    }
    return (
      <div
        className={cls(styles.icon, !CommentReplyNode.is(node) ? node.icon : '')}
        style={{
          height: COMMENT_TREE_NODE_HEIGHT,
          lineHeight: `${COMMENT_TREE_NODE_HEIGHT}px`,
        }}
      ></div>
    );
  }, []);

  const renderDisplayName = useCallback((node: CommentFileNode | CommentContentNode | CommentReplyNode) => {
    if (CommentContentNode.is(node)) {
      return (
        <div className={cls(styles.segment, styles.displayname)}>
          {node.comment}
          <span className={styles.separator}>·</span>
          {node.author.name}
        </div>
      );
    } else {
      return <div className={cls(styles.segment, styles.displayname)}>{node.displayName}</div>;
    }
  }, []);

  const renderDescription = useCallback(
    (node: CommentFileNode | CommentContentNode | CommentReplyNode) => (
      <div className={cls(styles.segment_grow, styles.description)}>{node.description}</div>
    ),
    [],
  );

  const renderFolderToggle = useCallback(
    (node: CommentFileNode) => (
      <div
        className={cls(styles.segment, styles.expansion_toggle, getIcon('arrow-right'), {
          [`${styles.mod_collapsed}`]: !(node as CommentFileNode).expanded,
        })}
      />
    ),
    [],
  );

  const renderTwice = useCallback((node: CommentFileNode | CommentContentNode | CommentReplyNode) => {
    if (CommentFileNode.is(node)) {
      return renderFolderToggle(node as CommentFileNode);
    }
  }, []);

  const getItemTooltip = useCallback(() => item.tooltip, [item]);

  return (
    <div
      key={item.id}
      onClick={handleClick}
      title={getItemTooltip()}
      className={cls(styles.search_node, decorations ? decorations.classlist : null)}
      style={renderedNodeStyle}
      data-id={item.id}
    >
      <div className={styles.content}>
        {renderTwice(item)}
        {renderIcon(item)}
        <div className={styles.overflow_wrap}>
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
      </div>
    </div>
  );
};

export const COMMENT_TREE_NODE_HEIGHT = 22;
