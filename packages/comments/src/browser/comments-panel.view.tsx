import React, { FC, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IRecycleTreeHandle, RecycleTree } from '@opensumi/ide-components';
import { useInjectable, ViewState, localize } from '@opensumi/ide-core-browser';

import { ICommentsFeatureRegistry } from '../common';

import styles from './comments.module.less';
import { CommentNodeRendered, COMMENT_TREE_NODE_HEIGHT, ICommentNodeRenderedProps } from './tree/comment-node';
import { CommentModelService, CommentTreeModel } from './tree/tree-model.service';

export const CommentsPanel: FC<{ viewState: ViewState }> = ({ viewState }) => {
  const commentModelService = useInjectable<CommentModelService>(CommentModelService);
  const [model, setModel] = useState<CommentTreeModel | undefined>();
  const wrapperRef: RefObject<HTMLDivElement> = useRef(null);

  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);

  const { handleTreeBlur } = commentModelService;

  useEffect(() => {
    setModel(commentModelService.treeModel);
    const disposable = commentModelService.onDidUpdateTreeModel((model?: CommentTreeModel) => {
      setModel(model);
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      commentModelService.handleTreeHandler(handle);
    },
    [commentModelService],
  );

  const renderTreeNode = useCallback(
    (props: ICommentNodeRenderedProps) => (
      <CommentNodeRendered
        item={props.item}
        itemType={props.itemType}
        decorations={commentModelService.decorations.getDecorations(props.item as any)}
        defaultLeftPadding={8}
        onTwistierClick={commentModelService.handleTwistierClick}
        onClick={commentModelService.handleItemClick}
        leftPadding={8}
      />
    ),
    [model],
  );

  const commentsPanelOptions = useMemo(() => commentsFeatureRegistry.getCommentsPanelOptions(), []);

  const headerComponent = useMemo(() => commentsPanelOptions.header, [commentsPanelOptions]);

  const defaultPlaceholder = useMemo(
    () => (
      <div className={styles.panel_placeholder}>
        {commentsPanelOptions.defaultPlaceholder || localize('comments.panel.placeholder')}
      </div>
    ),
    [commentsPanelOptions],
  );

  const renderCommentTree = useCallback(() => {
    if (model) {
      return (
        <RecycleTree
          height={viewState.height - (headerComponent?.height || 0)}
          itemHeight={COMMENT_TREE_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model}
          placeholder={() => defaultPlaceholder}
        >
          {renderTreeNode}
        </RecycleTree>
      );
    } else {
      return defaultPlaceholder;
    }
  }, [model, headerComponent, viewState.height]);

  return (
    <div className={styles.comment_panel} tabIndex={-1} onBlur={handleTreeBlur} ref={wrapperRef}>
      {headerComponent?.component}
      {renderCommentTree()}
    </div>
  );
};
