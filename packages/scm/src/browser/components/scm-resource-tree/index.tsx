import clx from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { FC, useState, useRef, useEffect, useCallback, memo } from 'react';

import { RecycleTree, IRecycleTreeHandle, TreeNodeType, TreeModel } from '@opensumi/ide-components';
import { isOSX } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';

import { ViewModelContext } from '../../scm-model';

import styles from './index.module.less';
import { SCMTreeModelService } from './scm-tree-model.service';
import { SCMResourceFolder, SCMResourceFile, SCMResourceGroup, SCMResourceNotRoot } from './scm-tree-node';
import { ISCMTreeNodeProps, SCMTreeNode, SCM_TREE_NODE_HEIGHT } from './scm-tree-node.view';
import { SCMTreeService } from './scm-tree.service';

export const TREE_FIELD_NAME = 'SCM_TREE_TREE_FIELD';

export const SCMResourceTree: FC<{
  width: number;
  height: number;
}> = observer(({ height }) => {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [model, setModel] = useState<TreeModel>();

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const scmTreeModelService = useInjectable<SCMTreeModelService>(SCMTreeModelService);

  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  // effects
  useEffect(() => {
    // ensure ready
    (async () => {
      await scmTreeModelService.whenReady;
      if (scmTreeModelService.treeModel) {
        // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
        // 这里需要重新取一下treeModel的值确保为最新的TreeModel
        await scmTreeModelService.treeModel.ensureReady;
      }
      setIsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (isReady) {
      setModel(scmTreeModelService.treeModel);
      scmTreeModelService.onDidTreeModelChange(async (model) => {
        if (model) {
          // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
          await model.ensureReady;
        }
        setModel(model);
      });
    }
  }, [isReady]);

  useEffect(() => {
    const handleBlur = () => {
      scmTreeModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      scmTreeModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  // event handlers
  const handleTreeReady = useCallback((handle: IRecycleTreeHandle) => {
    scmTreeModelService.handleTreeHandler({
      ...handle,
      getModel: () => scmTreeModelService.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  }, []);

  const hasShiftMask = useCallback((event: React.MouseEvent): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  }, []);

  const hasCtrlCmdMask = useCallback((event: React.MouseEvent): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  }, []);

  const handleItemClick = useCallback(
    (event: React.MouseEvent, item: SCMResourceFile | SCMResourceGroup, type: TreeNodeType) => {
      // 阻止点击事件冒泡
      event.stopPropagation();

      if (!item) {
        return;
      }

      const shiftMask = hasShiftMask(event);
      const ctrlCmdMask = hasCtrlCmdMask(event);
      // 多选
      if (shiftMask) {
        scmTreeModelService.handleItemRangeClick(item, type);
      } else if (ctrlCmdMask) {
        scmTreeModelService.handleItemToggleClick(item, type);
      } else {
        scmTreeModelService.handleItemClick(item, type);
      }
    },
    [],
  );

  const handleTwistierClick = useCallback((ev: React.MouseEvent, item: SCMResourceFolder) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    scmTreeModelService.toggleDirectory(item);
  }, []);

  const handleItemDoubleClick = useCallback((event: React.MouseEvent, item: SCMResourceNotRoot, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    event.stopPropagation();

    if (!item) {
      return;
    }
    scmTreeModelService.handleItemDoubleClick(item, type);
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, item: SCMResourceNotRoot, type: TreeNodeType) => {
    event.preventDefault();
    scmTreeModelService.handleContextMenu(event, item, type);
  }, []);

  return (
    <div
      className={clx(styles.scm_tree_container, { 'scm-show-actions': viewModel.alwaysShowActions })}
      tabIndex={-1}
      ref={wrapperRef}
      data-name={TREE_FIELD_NAME}
    >
      <SCMTreeView
        isReady={isReady}
        model={model}
        height={height}
        onTreeReady={handleTreeReady}
        onItemClick={handleItemClick}
        onItemDoubleClick={handleItemDoubleClick}
        onTwistierClick={handleTwistierClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
});

SCMResourceTree.displayName = 'SCMResourceTree';

interface TreeViewProps {
  isReady: boolean;
  model: TreeModel | undefined;
  height: number;
  onTreeReady(handle: IRecycleTreeHandle): void;
  onItemClick(event: React.MouseEvent, item: SCMResourceFile | SCMResourceGroup, type: TreeNodeType): void;
  onItemDoubleClick(event: React.MouseEvent, item: SCMResourceNotRoot, type: TreeNodeType): void;
  onContextMenu(event: React.MouseEvent, item: SCMResourceNotRoot, type: TreeNodeType): void;
  onTwistierClick(event: React.MouseEvent, item: SCMResourceFolder): void;
}

function isTreeViewPropsEqual(prevProps: TreeViewProps, nextProps: TreeViewProps) {
  return (
    prevProps.isReady === nextProps.isReady &&
    prevProps.model === nextProps.model &&
    prevProps.height === nextProps.height
  );
}

const SCMTreeView = memo(
  ({
    isReady,
    model,
    height,
    onTreeReady,
    onItemClick,
    onItemDoubleClick,
    onTwistierClick,
    onContextMenu,
  }: TreeViewProps) => {
    const scmTreeModelService = useInjectable<SCMTreeModelService>(SCMTreeModelService);
    const scmTreeService = useInjectable<SCMTreeService>(SCMTreeService);
    const renderSCMTreeNode = useCallback(
      (props: ISCMTreeNodeProps) => (
        <SCMTreeNode
          item={props.item}
          itemType={props.itemType}
          decorationService={scmTreeModelService.decorationService}
          labelService={scmTreeModelService.labelService}
          commandService={scmTreeModelService.commandService}
          decorations={scmTreeModelService.decorations.getDecorations(props.item)}
          onClick={onItemClick}
          onDoubleClick={onItemDoubleClick}
          onTwistierClick={onTwistierClick}
          onContextMenu={onContextMenu}
          defaultLeftPadding={scmTreeService.isTreeMode ? -4 : 4}
          leftPadding={scmTreeService.isTreeMode ? 8 : 0}
          iconTheme={scmTreeModelService.iconThemeDesc}
        />
      ),
      [model, scmTreeService, scmTreeModelService],
    );

    if (isReady && !!model) {
      return (
        <RecycleTree
          height={height}
          itemHeight={SCM_TREE_NODE_HEIGHT}
          onReady={onTreeReady}
          model={model}
          overScanCount={100}
        >
          {renderSCMTreeNode}
        </RecycleTree>
      );
    }
    return <span className={styles.scm_tree_empty_text} />;
  },
  isTreeViewPropsEqual,
);

SCMTreeView.displayName = 'SCMResourceTreeView';
