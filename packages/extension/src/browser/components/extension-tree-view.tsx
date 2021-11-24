import React from 'react';
import styles from './extension-tree-view.module.less';
import { isOSX } from '@opensumi/ide-core-browser';
import { Injector } from '@opensumi/di';
import { observer } from 'mobx-react-lite';
import { ViewState } from '@opensumi/ide-core-browser';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';

import { ExtensionTreeViewModel } from '../vscode/api/tree-view/tree-view.model.service';
import { RecycleTree, INodeRendererProps, IRecycleTreeHandle, TreeNodeType } from '@opensumi/ide-components';
import { TREE_VIEW_NODE_HEIGHT, TreeViewNode } from './extension-tree-view-node';
import { ExtensionCompositeTreeNode, ExtensionTreeNode } from '../vscode/api/tree-view/tree-view.node.defined';
import { TreeViewDataProvider } from '../vscode/api/main.thread.treeview';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';

export interface ExtensionTabBarTreeViewProps {
  injector: Injector;
  viewState: ViewState;
  dataProvider: TreeViewDataProvider;
  model: ExtensionTreeViewModel;
  treeViewId: string;
}

export const ExtensionTabBarTreeView = observer(({
  viewState,
  model,
  dataProvider,
  treeViewId,
}: React.PropsWithChildren<ExtensionTabBarTreeViewProps>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [isEmpty, setIsEmpty] = React.useState(dataProvider.isTreeEmpty);

  React.useEffect(() => {
    const disposable = dataProvider.onDidChangeEmpty(() => {
      setIsEmpty(dataProvider.isTreeEmpty);
    });
    return () => disposable.dispose();
  }, []);

  const { width, height } = viewState;
  const { canSelectMany } = model.treeViewOptions || {};
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    model.handleTreeHandler({
      ...handle,
      getModel: () => model.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: ExtensionCompositeTreeNode) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { toggleDirectory } = model;

    toggleDirectory(item);

  };

  const hasShiftMask = (event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  };

  const hasCtrlCmdMask = (event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  };

  const handleItemClicked = (ev: React.MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleItemClick, handleItemToggleClick, handleItemRangeClick } = model;
    if (!item) {
      return;
    }
    const shiftMask = hasShiftMask(event);
    const ctrlCmdMask = hasCtrlCmdMask(event);
    if (canSelectMany) {
      if (shiftMask) {
        handleItemRangeClick(item, type);
      } else if (ctrlCmdMask) {
        handleItemToggleClick(item, type);
      }
    } else {
      handleItemClick(item, type);
    }
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    const { handleContextMenu } = model;
    handleContextMenu(ev, node);
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = model;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handleOuterClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = model;
    enactiveNodeDecoration();
  };

  React.useEffect(() => {
    let unmouted = false;
    (async () => {
      await model.whenReady;
      if (!!model.treeModel) {
        // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
        // 这里需要重新取一下treeModel的值确保为最新的TreeModel
        await model.treeModel.root.ensureLoaded();
      }
      if (!unmouted) {
        setIsReady(true);
      }
    })();
    return () => {
      unmouted = true;
      model && model.removeNodeDecoration();
    };
  }, [model]);

  React.useEffect(() => {
    const handleBlur = () => {
      model.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
    };
  }, [wrapperRef.current]);

  const renderTreeNode = React.useCallback((props: INodeRendererProps) => {
    return <TreeViewNode
      item={props.item as any}
      itemType={props.itemType}
      decorations={model.decorations.getDecorations(props.item as any)}
      onClick={handleItemClicked}
      onTwistierClick={handleTwistierClick}
      onContextMenu={handlerContextMenu}
      defaultLeftPadding={8}
      leftPadding={8}
      treeViewId={treeViewId}
    />;
  }, [model.treeModel]);

  const renderTreeView = () => {
    if (!isReady) {
      return <ProgressBar loading />;
    } else if (isEmpty) {
      return <WelcomeView viewId={treeViewId} />;
    } else {
      if (model.treeModel) {
        return <RecycleTree
          height={height}
          width={width}
          itemHeight={TREE_VIEW_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model.treeModel}
        >
          {renderTreeNode}
        </RecycleTree>;
      }
    }
  };

  return <div
    className={styles.kt_extension_view}
    tabIndex={-1}
    ref={wrapperRef}
    onContextMenu={handleOuterContextMenu}
    onClick={handleOuterClick}
    data-tree-view-id={treeViewId}
  >
    {renderTreeView()}
  </div>;
});
