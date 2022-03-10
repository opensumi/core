import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { IRecycleTreeHandle, RecycleTree, INodeRendererWrapProps, TreeNodeEvent } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { IDisposable } from '@opensumi/ide-core-common';

import {
  ExpressionNode,
  ExpressionContainer,
  DebugHoverVariableRoot,
  DebugVariable,
} from '../tree/debug-tree-node.define';
import { DebugVariableRenderedNode, DEBUG_VARIABLE_TREE_NODE_HEIGHT } from '../view/variables/debug-variables.view';

import { DebugHoverModel } from './debug-hover-model';
import { DebugHoverTreeModelService, IDebugHoverUpdateData } from './debug-hover-tree.model.service';
import styles from './debug-hover.module.less';


export const DebugHoverView = observer(() => {
  const debugHoverTreeModelService: DebugHoverTreeModelService = useInjectable(DebugHoverTreeModelService);
  const DEFAULT_LAYOUT_HEIGHT = 250;

  const [model, setModel] = React.useState<{ treeModel?: DebugHoverModel; variable?: DebugVariable }>({});
  const [treeLayoutHeight, setTreeLayoutHeight] = React.useState<number>(DEFAULT_LAYOUT_HEIGHT);
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  React.useEffect(() => {
    debugHoverTreeModelService.onDidUpdateTreeModelOrVariable(async (data: IDebugHoverUpdateData) => {
      const { treeModel, variable } = data;
      if (treeModel) {
        await treeModel.root.ensureLoaded();
      }
      setModel({ treeModel, variable });
    });
    ensureLoaded();
    return () => {
      debugHoverTreeModelService.removeNodeDecoration();
    };
  }, []);

  React.useEffect(() => {
    let disposable: IDisposable;
    setTreeLayoutHeight(DEFAULT_LAYOUT_HEIGHT);

    if (model.treeModel) {
      disposable = model.treeModel.root.watcher.on(TreeNodeEvent.DidChangeExpansionState, (data) => {
        const treeHeight = Math.max(DEFAULT_LAYOUT_HEIGHT, ~~model.treeModel?.root.branchSize! * 22);
        setTreeLayoutHeight(Math.min(500, treeHeight));
      });
    }
    return () => {
      disposable?.dispose();
    };
  }, [model.treeModel]);

  const ensureLoaded = async () => {
    if (debugHoverTreeModelService.treeModel) {
      await debugHoverTreeModelService.treeModel!.root.ensureLoaded();
      setModel({ treeModel: debugHoverTreeModelService.treeModel });
    }
  };

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    debugHoverTreeModelService.handleTreeHandler({
      ...handle,
      getModel: () => model?.treeModel!,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: ExpressionNode | ExpressionContainer) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleTwistierClick } = debugHoverTreeModelService;
    if (!item) {
      return;
    }
    handleTwistierClick(item);
  };

  const shouldRenderVariableTree =
    !!model.treeModel && !!(model.treeModel.root as DebugHoverVariableRoot).variablesReference;

  const renderVariableTreeNode = React.useCallback(
    (props: INodeRendererWrapProps) => {
      const decorations = debugHoverTreeModelService.decorations.getDecorations(props.item as any);
      return (
        <DebugVariableRenderedNode
          item={props.item}
          itemType={props.itemType}
          decorations={decorations}
          onClick={handleTwistierClick}
          onTwistierClick={handleTwistierClick}
          defaultLeftPadding={0}
          leftPadding={4}
        />
      );
    },
    [model.treeModel],
  );

  const renderVariableTree = () => {
    if (!shouldRenderVariableTree) {
      return null;
    }
    return (
      <div className={styles.debug_hover_content} tabIndex={-1} ref={wrapperRef}>
        <RecycleTree
          height={treeLayoutHeight}
          itemHeight={DEBUG_VARIABLE_TREE_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model.treeModel!}
          placeholder={() => <span></span>}
          overflow={'auto'}
        >
          {renderVariableTreeNode}
        </RecycleTree>
      </div>
    );
  };

  return (
    <div className={styles.debug_hover}>
      {model.treeModel ? (
        <div
          className={cls(styles.debug_hover_title, shouldRenderVariableTree && styles.has_complex_value)}
          title={model.treeModel.root.name}
        >
          {model.treeModel.root.name}
        </div>
      ) : (
        model.variable && (
          <div
            className={cls(styles.debug_hover_title, shouldRenderVariableTree && styles.has_complex_value)}
            title={model.variable.name}
          >
            {model.variable.value}
          </div>
        )
      )}
      {renderVariableTree()}
    </div>
  );
});
