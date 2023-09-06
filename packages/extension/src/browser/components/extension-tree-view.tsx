import { observer } from 'mobx-react-lite';
import React, {
  memo,
  MouseEvent,
  DragEvent,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Injector } from '@opensumi/di';
import { RecycleTree, INodeRendererProps, IRecycleTreeHandle, TreeNodeType } from '@opensumi/ide-components';
import { ViewState } from '@opensumi/ide-core-browser';
import { isOSX, useInjectable } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common/main-layout.definition';

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
  ({ viewState, model, dataProvider, treeViewId }: PropsWithChildren<ExtensionTabBarTreeViewProps>) => {
    const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
    const decorationService = useInjectable<IDecorationsService>(IDecorationsService);
    const accordionService = useMemo(() => layoutService.getViewAccordionService(treeViewId), []);

    const isVisible = useMemo(() => {
      const state = accordionService?.getViewState(treeViewId);
      if (!state) {
        return false;
      }
      return !state.collapsed && !state.hidden;
    }, [accordionService]);

    const { height } = viewState;
    const { canSelectMany } = model.treeViewOptions || {};
    const wrapperRef = useRef<HTMLDivElement | null>(null);

    const handleTreeReady = useCallback(
      (handle: IRecycleTreeHandle) => {
        model.handleTreeHandler({
          ...handle,
          getModel: () => model.treeModel,
          hasDirectFocus: () => wrapperRef.current === document.activeElement,
        });
      },
      [model],
    );

    const handleTwistierClick = useCallback(
      (ev: MouseEvent, item: ExtensionCompositeTreeNode) => {
        // 阻止点击事件冒泡
        ev.stopPropagation();

        const { toggleDirectory } = model;

        toggleDirectory(item);
      },
      [model],
    );

    const hasShiftMask = useCallback((event): boolean => {
      // Ctrl/Cmd 权重更高
      if (hasCtrlCmdMask(event)) {
        return false;
      }
      return event.shiftKey;
    }, []);

    const hasCtrlCmdMask = useCallback((event): boolean => {
      const { metaKey, ctrlKey } = event;
      return (isOSX && metaKey) || ctrlKey;
    }, []);

    const handleItemClicked = useCallback(
      (ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
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
          } else {
            handleItemClick(item, type);
          }
        } else {
          handleItemClick(item, type);
        }
      },
      [canSelectMany, model],
    );

    const handleContextMenu = useCallback(
      (ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleContextMenu } = model;
        handleContextMenu(ev, node);
      },
      [model],
    );

    const handleOuterContextMenu = (ev: MouseEvent) => {
      const { handleContextMenu } = model;
      // 空白区域右键菜单
      handleContextMenu(ev);
    };

    const handleOuterClick = useCallback(() => {
      // 空白区域点击，取消焦点状态
      const { enactiveNodeDecoration } = model;
      enactiveNodeDecoration();
    }, [model]);

    const handleDragStart = useCallback(
      (ev: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleDragStart } = model;
        handleDragStart(ev, node);
      },
      [model],
    );

    const handleDragOver = useCallback(
      (ev: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleDragOver } = model;
        handleDragOver(ev, node);
      },
      [model],
    );

    const handleDragEnter = useCallback(
      (ev: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleDragEnter } = model;
        handleDragEnter(ev, node);
      },
      [model],
    );

    const handleDrop = useCallback(
      (ev: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleDrop } = model;
        handleDrop(ev, node);
      },
      [model],
    );

    const handleDragLeave = useCallback(
      (ev: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
        const { handleDragLeave } = model;
        handleDragLeave(ev, node);
      },
      [model],
    );

    useEffect(() => {
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
          height={height}
          isVisible={isVisible}
          handleTreeReady={handleTreeReady}
          handleItemClicked={handleItemClicked}
          handleTwistierClick={handleTwistierClick}
          handleContextMenu={handleContextMenu}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          draggable={model.draggable}
          treeViewId={treeViewId}
          model={model}
          dataProvider={dataProvider}
          decorationService={decorationService}
        />
      </div>
    );
  },
);

interface TreeViewProps {
  isVisible: boolean;
  height: number;
  treeViewId: string;
  dataProvider: TreeViewDataProvider;
  model: ExtensionTreeViewModel;
  handleTreeReady(handle: IRecycleTreeHandle): void;
  handleItemClicked(ev: MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType): void;
  handleTwistierClick(ev: MouseEvent, item: ExtensionCompositeTreeNode): void;
  handleContextMenu(ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
  handleDragStart(ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
  handleDragEnter(ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
  handleDrop(ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
  handleDragLeave(ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
  handleDragOver(ev: MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode): void;
  decorationService: IDecorationsService;
  draggable: boolean;
}

function isTreeViewPropsEqual(prevProps: TreeViewProps, nextProps: TreeViewProps) {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.model === nextProps.model &&
    prevProps.treeViewId === nextProps.treeViewId &&
    prevProps.height === nextProps.height
  );
}

const TreeView = memo(
  ({
    model,
    treeViewId,
    height,
    isVisible,
    dataProvider,
    handleTreeReady,
    handleItemClicked,
    handleTwistierClick,
    handleContextMenu,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    draggable,
    decorationService,
  }: TreeViewProps) => {
    const [isReady, setIsReady] = useState<boolean>(false);
    const [isEmpty, setIsEmpty] = useState(false);

    useEffect(() => {
      let unmouted = false;
      (async () => {
        await model.whenReady;
        if (model.treeModel && isVisible) {
          await model.treeModel.ensureReady;
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

    useEffect(() => {
      const disposable = dataProvider.onDidChangeEmpty(() => {
        if (dataProvider.isTreeEmpty !== isEmpty) {
          setIsEmpty(dataProvider.isTreeEmpty);
        }
      });
      return () => disposable.dispose();
    }, []);

    const renderTreeNode = useCallback(
      (props: INodeRendererProps) => (
        <TreeViewNode
          item={props.item as any}
          itemType={props.itemType}
          decorations={model.decorations.getDecorations(props.item as any)}
          onClick={handleItemClicked}
          onTwistierClick={handleTwistierClick}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          defaultLeftPadding={8}
          leftPadding={8}
          treeViewId={treeViewId}
          draggable={draggable}
          decorationService={decorationService}
        />
      ),
      [model.treeModel],
    );

    if (!isReady) {
      return <Progress loading />;
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
