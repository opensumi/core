import React, {
  PropsWithChildren,
  useCallback,
  RefObject,
  MouseEvent,
  useState,
  createRef,
  useEffect,
  memo,
} from 'react';

import { RecycleTree, IRecycleTreeHandle, INodeRendererWrapProps, TreeNodeType } from '@opensumi/ide-components';
import { ViewState } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';

import { OUTLINE_TREE_NODE_HEIGHT, OutlineNode } from './outline-node';
import { OutlineCompositeTreeNode, OutlineTreeNode } from './outline-node.define';
import styles from './outline.module.less';
import { OutlineTreeModel } from './services/outline-model';
import { OutlineModelService } from './services/outline-model.service';

export const OutlinePanel = ({ viewState }: PropsWithChildren<{ viewState: ViewState }>) => {
  const { height } = viewState;

  const wrapperRef: RefObject<HTMLDivElement> = createRef();

  const outlineModelService = useInjectable<OutlineModelService>(OutlineModelService);
  const [model, setModel] = useState<OutlineTreeModel | undefined>(undefined);

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      outlineModelService.handleTreeHandler({
        ...handle,
        hasDirectFocus: () => wrapperRef.current === document.activeElement,
      });
    },
    [outlineModelService, wrapperRef.current],
  );

  const handleItemClicked = useCallback(
    (ev: MouseEvent, item: OutlineTreeNode | OutlineCompositeTreeNode, type: TreeNodeType) => {
      // 阻止点击事件冒泡
      ev.stopPropagation();

      const { handleItemClick } = outlineModelService;
      if (!item) {
        return;
      }
      handleItemClick(item, type);
    },
    [outlineModelService],
  );

  const handleTwistierClicked = useCallback(
    (ev: MouseEvent, item: OutlineTreeNode | OutlineCompositeTreeNode) => {
      // 阻止点击事件冒泡
      ev.stopPropagation();

      const { toggleDirectory } = outlineModelService;
      if (!item) {
        return;
      }
      toggleDirectory(item as OutlineCompositeTreeNode);
    },
    [outlineModelService],
  );

  const handleOuterClick = useCallback(() => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = outlineModelService;
    enactiveNodeDecoration();
  }, [outlineModelService]);

  useEffect(() => {
    setModel(outlineModelService.treeModel);
    const disposable = outlineModelService.onDidUpdateTreeModel((model?: OutlineTreeModel) => {
      setModel(model);
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      outlineModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      outlineModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  return (
    <div className={styles.outline_container} tabIndex={-1} ref={wrapperRef} onClick={handleOuterClick}>
      <OutlineTreeView
        height={height}
        model={model}
        onItemClick={handleItemClicked}
        onTwistierClick={handleTwistierClicked}
        onDidTreeReady={handleTreeReady}
      />
    </div>
  );
};

interface IOutlineTreeViewProps {
  height: number;
  model?: OutlineTreeModel;
  onDidTreeReady(handle: IRecycleTreeHandle): void;
  onItemClick(ev: MouseEvent, item: OutlineTreeNode | OutlineCompositeTreeNode, type: TreeNodeType): void;
  onTwistierClick(ev: MouseEvent, item: OutlineTreeNode | OutlineCompositeTreeNode): void;
}

export const OutlineTreeView = memo(
  ({ height, model, onItemClick, onTwistierClick, onDidTreeReady }: IOutlineTreeViewProps) => {
    const outlineModelService = useInjectable<OutlineModelService>(OutlineModelService);
    const { decorationService, commandService } = outlineModelService;

    const renderTreeNode = useCallback(
      (props: INodeRendererWrapProps) => (
        <OutlineNode
          item={props.item}
          itemType={props.itemType}
          decorationService={decorationService}
          commandService={commandService}
          decorations={outlineModelService.decorations.getDecorations(props.item as any)}
          onClick={onItemClick}
          onTwistierClick={onTwistierClick}
          defaultLeftPadding={8}
          leftPadding={8}
        />
      ),
      [model],
    );
    // if (outlineModelService.isLoading) {
    //   return <Progress loading={true} />;
    // }
    if (!model) {
      return <span className={styles.outline_empty_text}>{localize('outline.nomodel')}</span>;
    } else {
      return (
        <RecycleTree
          height={height}
          itemHeight={OUTLINE_TREE_NODE_HEIGHT}
          onReady={onDidTreeReady}
          model={model}
          placeholder={() => <span className={styles.outline_empty_text}>{localize('outline.noinfo')}</span>}
        >
          {renderTreeNode}
        </RecycleTree>
      );
    }
  },
);

OutlineTreeView.displayName = 'OutlineTreeView';
