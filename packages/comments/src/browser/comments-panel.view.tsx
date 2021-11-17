import React from 'react';
import { DeprecatedRecycleTree } from '@ide-framework/ide-core-browser/lib/components';
import { observer } from 'mobx-react-lite';
import { useInjectable, isUndefined, ViewState, IEventBus, localize } from '@ide-framework/ide-core-browser';
import { ICommentsService, ICommentsTreeNode, CommentPanelCollapse, ICommentsFeatureRegistry } from '../common';
import styles from './comments.module.less';
import { WorkbenchEditorService } from '@ide-framework/ide-editor';
import clx from 'classnames';

export const CommentsPanel = observer<{ viewState: ViewState; className?: string}>((props) => {
  const commentsService = useInjectable<ICommentsService>(ICommentsService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const [ treeNodes, setTreeNodes ] = React.useState<ICommentsTreeNode[]>([]);
  const eventBus: IEventBus = useInjectable(IEventBus);

  React.useEffect(() => {
    eventBus.on(CommentPanelCollapse, () => {
      setTreeNodes((nodes) => nodes.map((node) => {
        if (!isUndefined(node.expanded)) {
          node.expanded = false;
        }
        return node;
      }));
    });
  }, []);

  const getRenderTree = React.useCallback((nodes: ICommentsTreeNode[]) => {
    return nodes.filter((node) => {
      if (node && node.parent) {
        if (node.parent.expanded === false || node.parent.parent?.expanded === false) {
          return false;
        }
      }
      return true;
    });
  }, []);

  React.useEffect(() => {
    setTreeNodes(commentsService.commentsTreeNodes);
  }, [commentsService.commentsTreeNodes]);

  const handleSelect = React.useCallback(([item]: [ ICommentsTreeNode ]) => {
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
  }, [workbenchEditorService, treeNodes]);

  const commentsPanelOptions = React.useMemo(() => {
    return commentsFeatureRegistry.getCommentsPanelOptions();
  }, []);

  const headerComponent = React.useMemo(() => {
    return commentsPanelOptions.header;
  }, [commentsPanelOptions]);

  const treeHeight = React.useMemo(() => {
    return props.viewState.height - (headerComponent?.height || 0);
  }, [props.viewState.height]);

  const scrollContainerStyle = React.useMemo(() => {
    return {
      width: '100%',
      height: treeHeight,
    };
  }, [treeHeight]);

  const defaultPlaceholder = React.useMemo(() => {
    return commentsPanelOptions.defaultPlaceholder;
  }, [commentsPanelOptions]);

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
      ) : (
        (!defaultPlaceholder || typeof defaultPlaceholder === 'string') ? <div className={styles.panel_placeholder}>{defaultPlaceholder || localize('comments.panel.placeholder')}</div> : defaultPlaceholder
      )}
    </div>
  );
});
