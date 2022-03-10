import clx from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { useInjectable, isUndefined, ViewState, IEventBus, localize } from '@opensumi/ide-core-browser';
import { DeprecatedRecycleTree } from '@opensumi/ide-core-browser/lib/components';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { ICommentsService, ICommentsTreeNode, CommentPanelCollapse, ICommentsFeatureRegistry } from '../common';

import styles from './comments.module.less';

export const CommentsPanel = observer<{ viewState: ViewState; className?: string }>((props) => {
  const commentsService = useInjectable<ICommentsService>(ICommentsService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const [treeNodes, setTreeNodes] = React.useState<ICommentsTreeNode[]>([]);
  const eventBus: IEventBus = useInjectable(IEventBus);

  React.useEffect(() => {
    eventBus.on(CommentPanelCollapse, () => {
      setTreeNodes((nodes) =>
        nodes.map((node) => {
          if (!isUndefined(node.expanded)) {
            node.expanded = false;
          }
          return node;
        }),
      );
    });
  }, []);

  const getRenderTree = React.useCallback(
    (nodes: ICommentsTreeNode[]) =>
      nodes.filter((node) => {
        if (node && node.parent) {
          if (node.parent.expanded === false || node.parent.parent?.expanded === false) {
            return false;
          }
        }
        return true;
      }),
    [],
  );

  React.useEffect(() => {
    setTreeNodes(commentsService.commentsTreeNodes);
  }, [commentsService.commentsTreeNodes]);

  const handleSelect = React.useCallback(
    ([item]: [ICommentsTreeNode]) => {
      // 可能点击到空白位置
      if (!item) {
        return;
      }

      if (!isUndefined(item.expanded)) {
        const newNodes = treeNodes.map((node) => {
          if (node.id === item.id) {
            node.expanded = !node.expanded;
          }
          node.selected = node.id === item.id;
          return node;
        });
        setTreeNodes(newNodes);
      } else {
        const newNodes = treeNodes.map((node) => {
          node.selected = node.id === item.id;
          return node;
        });
        setTreeNodes(newNodes);
      }

      if (item.onSelect) {
        item.onSelect(item);
      } else {
        workbenchEditorService.open(item.uri!, {
          range: item.thread.range,
        });
      }
    },
    [workbenchEditorService, treeNodes],
  );

  const commentsPanelOptions = React.useMemo(() => commentsFeatureRegistry.getCommentsPanelOptions(), []);

  const headerComponent = React.useMemo(() => commentsPanelOptions.header, [commentsPanelOptions]);

  const treeHeight = React.useMemo(
    () => props.viewState.height - (headerComponent?.height || 0),
    [props.viewState.height],
  );

  const scrollContainerStyle = React.useMemo(
    () => ({
      width: '100%',
      height: treeHeight,
    }),
    [treeHeight],
  );

  const defaultPlaceholder = React.useMemo(() => commentsPanelOptions.defaultPlaceholder, [commentsPanelOptions]);

  const nodes = getRenderTree(treeNodes);

  return (
    <div className={clx(props.className, styles.comment_panel)}>
      {headerComponent?.component}
      {nodes.length ? (
        <DeprecatedRecycleTree
          containerHeight={treeHeight}
          scrollContainerStyle={scrollContainerStyle}
          nodes={nodes}
          foldable={true}
          outline={false}
          onSelect={(item) => handleSelect(item)}
          leftPadding={20}
          {...commentsPanelOptions.recycleTreeProps}
        />
      ) : !defaultPlaceholder || typeof defaultPlaceholder === 'string' ? (
        <div className={styles.panel_placeholder}>{defaultPlaceholder || localize('comments.panel.placeholder')}</div>
      ) : (
        defaultPlaceholder
      )}
    </div>
  );
});
