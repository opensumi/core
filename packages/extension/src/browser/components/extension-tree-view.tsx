import { observer } from 'mobx-react-lite';
import React from 'react';

import { Injector } from '@opensumi/di';
import { RecycleTree, INodeRendererProps, IRecycleTreeHandle, TreeNodeType } from '@opensumi/ide-components';
import { ViewState } from '@opensumi/ide-core-browser';
import { isOSX, useInjectable } from '@opensumi/ide-core-browser';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common/main-layout.defination';

import { TreeViewDataProvider } from '../vscode/api/main.thread.treeview';
import { ExtensionTreeViewModel } from '../vscode/api/tree-view/tree-view.model.service';
import { ExtensionCompositeTreeNode, ExtensionTreeNode } from '../vscode/api/tree-view/tree-view.node.defined';

import { TREE_VIEW_NODE_HEIGHT, TreeViewNode } from './extension-tree-view-node';
import styles from './extension-tree-view.module.less';

export interface ExtensionTabBarTreeViewProps {
  injector: Injector;
  viewState: ViewState;
  dataProvider: TreeViewDataProvider;
  model: ExtensionTreeViewModel;
  treeViewId: string;
}

export const ExtensionTabBarTreeView = observer(
  ({ viewState, model, dataProvider, treeViewId }: React.PropsWithChildren<ExtensionTabBarTreeViewProps>) => {
    const [isReady, setIsReady] = React.useState<boolean>(false);
    const [isEmpty, setIsEmpty] = React.useState(dataProvider.isTreeEmpty);
    const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
    const accordionService = React.useMemo(() => layoutService.getViewAccordionService(treeViewId), []);

    const isVisible = React.useMemo(() => {
      const state = accordionService?.getViewState(treeViewId);
      if (!state) {
        return false;
      }
      return !state.collapsed && !state.hidden;
    }, [accordionService]);

    React.useEffect(() => {
      const disposable = dataProvider.onDidChangeEmpty(() => {
        setIsEmpty(dataProvider.isTreeEmpty);
      });
      return () => disposable.dispose();
    }, []);

    const { height } = viewState;
    const { canSelectMany } = model.treeViewOptions || {};
    const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

    const handleTreeReady = (handle: IRecycleTreeHandle) => {
      model.handleTreeHandler({
        ...handle,
        getModel: () => model.treeModel,
        hasDirectFocus: () => wrapperRef.current === document.activeElement,
      });
    };

    const handleTwistierClick = React.useCallback(
      (ev: React.MouseEvent, item: ExtensionCompositeTreeNode) => {
        // 阻止点击事件冒泡
        ev.stopPropagation();

        const { toggleDirectory } = model;

        toggleDirectory(item);
      },
      [model],
    );

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

    const handleItemClicked = React.useCallback(
      (ev: React.MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
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
      },
      [canSelectMany],
    );

    const handlerContextMenu = React.useCallback(
      (ev: React.MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleContextMenu } = model;
        handleContextMenu(ev, node);
      },
      [model],
    );

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
        if (model.treeModel && isVisible) {
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
    }, [model, isVisible]);

    React.useEffect(() => {
      const handleBlur = () => {
        model.handleTreeBlur();
      };
      wrapperRef.current?.addEventListener('blur', handleBlur, true);
      return () => {
        wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      };
    }, [wrapperRef.current]);

    return (
      <div
        className={styles.kt_extension_view}
        tabIndex={-1}
        ref={wrapperRef}
        onContextMenu={handleOuterContextMenu}
        onClick={handleOuterClick}
        data-tree-view-id={treeViewId}
      >
        <TreeView
          isReady={isReady}
          isEmpty={isEmpty}
          height={height}
          handleTreeReady={handleTreeReady}
          handleItemClicked={handleItemClicked}
          handleTwistierClick={handleTwistierClick}
          handlerContextMenu={handlerContextMenu}
          treeViewId={treeViewId}
          model={model}
        />
      </div>
    );
  },
);

interface TreeViewProps {
  isReady: boolean;
  isEmpty: boolean;
  height: number;
  treeViewId: string;
  model: ExtensionTreeViewModel;
  handleTreeReady(handle: IRecycleTreeHandle): void;
  handleItemClicked(
    ev: React.MouseEvent,
    item: ExtensionTreeNode | ExtensionCompositeTreeNode,
    type: TreeNodeType,
  ): void;
  handleTwistierClick(ev: React.MouseEvent, item: ExtensionCompositeTreeNode): void;
  handlerContextMenu(ev: React.MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
}

function isTreeViewPropsEqual(prevProps: TreeViewProps, nextProps: TreeViewProps) {
  return (
    prevProps.isReady === nextProps.isReady &&
    prevProps.isEmpty === nextProps.isEmpty &&
    prevProps.model === nextProps.model &&
    prevProps.treeViewId === nextProps.treeViewId &&
    prevProps.height === nextProps.height
  );
}

const TreeView = React.memo(
  ({
    isReady,
    isEmpty,
    model,
    treeViewId,
    height,
    handleTreeReady,
    handleItemClicked,
    handleTwistierClick,
    handlerContextMenu,
  }: TreeViewProps) => {
    const renderTreeNode = React.useCallback(
      (props: INodeRendererProps) => (
        <TreeViewNode
          item={props.item as any}
          itemType={props.itemType}
          decorations={model.decorations.getDecorations(props.item as any)}
          onClick={handleItemClicked}
          onTwistierClick={handleTwistierClick}
          onContextMenu={handlerContextMenu}
          defaultLeftPadding={8}
          leftPadding={8}
          treeViewId={treeViewId}
        />
      ),
      [model.treeModel],
    );

    if (!isReady) {
      return <ProgressBar loading />;
    } else if (isEmpty) {
      return <WelcomeView viewId={treeViewId} />;
    } else {
      if (model.treeModel) {
        return (
          <RecycleTree
            height={height}
            itemHeight={TREE_VIEW_NODE_HEIGHT}
            onReady={handleTreeReady}
            model={model.treeModel}
          >
            {renderTreeNode}
          </RecycleTree>
        );
      }
    }
    return null;
  },
  isTreeViewPropsEqual,
);

TreeView.displayName = 'ExtensionsTreeView';
