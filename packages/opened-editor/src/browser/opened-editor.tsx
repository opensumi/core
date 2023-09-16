import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  RecycleTree,
  IRecycleTreeHandle,
  INodeRendererWrapProps,
  TreeNodeType,
  TreeModel,
} from '@opensumi/ide-components';
import { ViewState, CancellationToken, localize, CancellationTokenSource } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';

import styles from './index.module.less';
import { EditorTreeNode } from './opened-editor-node';
import { EditorFile, EditorFileGroup } from './opened-editor-node.define';
import { OpenedEditorModelService } from './services/opened-editor-model.service';

export const ExplorerOpenEditorPanel = ({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const OPEN_EDITOR_NODE_HEIGHT = 22;
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [model, setModel] = useState<TreeModel | null>();

  const { width, height } = viewState;

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const openedEditorModelService = useInjectable<OpenedEditorModelService>(OpenedEditorModelService);
  const { decorationService, labelService, commandService } = openedEditorModelService;

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    openedEditorModelService.handleTreeHandler({
      ...handle,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleItemClicked = useCallback(
    (ev: React.MouseEvent, item: EditorFile | EditorFileGroup, type: TreeNodeType) => {
      // 阻止点击事件冒泡
      ev.stopPropagation();

      const { handleItemClick } = openedEditorModelService;
      if (!item) {
        return;
      }
      handleItemClick(item, type);
    },
    [openedEditorModelService],
  );

  const handlerContextMenu = useCallback((ev: React.MouseEvent, node: EditorFile | EditorFileGroup) => {
    const { handleContextMenu } = openedEditorModelService;
    handleContextMenu(ev, node);
  }, []);

  const handleOuterContextMenu = useCallback(
    (ev: React.MouseEvent) => {
      const { handleContextMenu } = openedEditorModelService;
      // 空白区域右键菜单
      handleContextMenu(ev);
    },
    [openedEditorModelService],
  );

  const handleOuterClick = useCallback(() => {
    // 空白区域点击，取消焦点状态
    const { enactiveFileDecoration } = openedEditorModelService;
    enactiveFileDecoration();
  }, []);

  const ensureIsReady = useCallback(
    async (token: CancellationToken) => {
      await openedEditorModelService.whenReady;
      if (token.isCancellationRequested) {
        return;
      }
      if (openedEditorModelService.treeModel) {
        setModel(openedEditorModelService.treeModel);
        // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
        // 这里需要重新取一下treeModel的值确保为最新的TreeModel
        await openedEditorModelService.treeModel.ensureReady;
        if (token.isCancellationRequested) {
          return;
        }
      }
      setIsLoading(false);
      setIsReady(true);
    },
    [isLoading, isReady, openedEditorModelService],
  );

  useEffect(() => {
    if (isReady) {
      openedEditorModelService.onTreeModelChange(async (treeModel) => {
        setIsLoading(true);
        if (treeModel) {
          // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
          await treeModel.ensureReady;
        }
        setModel(treeModel);
        setIsLoading(false);
      });
    }
  }, [isReady]);

  useEffect(() => {
    const tokenSource = new CancellationTokenSource();
    ensureIsReady(tokenSource.token);
    return () => {
      tokenSource.cancel();
    };
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      openedEditorModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      openedEditorModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  const renderTreeNode = useCallback(
    (props: INodeRendererWrapProps) => (
      <EditorTreeNode
        item={props.item}
        itemType={props.itemType}
        decorationService={decorationService}
        labelService={labelService}
        commandService={commandService}
        decorations={openedEditorModelService.decorations.getDecorations(props.item as any)}
        onClick={handleItemClicked}
        onContextMenu={handlerContextMenu}
        defaultLeftPadding={22}
        leftPadding={0}
      />
    ),
    [openedEditorModelService.treeModel],
  );

  const renderContent = () => {
    if (!isReady) {
      return <span className={styles.opened_editor_empty_text}>{localize('opened.editors.empty')}</span>;
    } else {
      if (isLoading) {
        return <Progress loading />;
      } else if (model) {
        return (
          <RecycleTree
            height={height}
            width={width}
            itemHeight={OPEN_EDITOR_NODE_HEIGHT}
            onReady={handleTreeReady}
            model={model}
            placeholder={() => (
              <span className={styles.opened_editor_empty_text}>{localize('opened.editors.empty')}</span>
            )}
          >
            {renderTreeNode}
          </RecycleTree>
        );
      } else {
        return <span className={styles.opened_editor_empty_text}>{localize('opened.editors.empty')}</span>;
      }
    }
  };

  return (
    <div
      className={styles.opened_editor_container}
      tabIndex={-1}
      ref={wrapperRef}
      onContextMenu={handleOuterContextMenu}
      onClick={handleOuterClick}
    >
      {renderContent()}
    </div>
  );
};
