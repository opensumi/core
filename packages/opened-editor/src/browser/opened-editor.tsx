import React from 'react';

import { RecycleTree, IRecycleTreeHandle, INodeRendererWrapProps, TreeNodeType } from '@opensumi/ide-components';
import { ViewState } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';

import styles from './index.module.less';
import { EditorTreeNode } from './opened-editor-node';
import { EditorFile, EditorFileGroup } from './opened-editor-node.define';
import { OpenedEditorModelService } from './services/opened-editor-model.service';

export const ExplorerOpenEditorPanel = ({ viewState }: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const OPEN_EDITOR_NODE_HEIGHT = 22;
  const [isReady, setIsReady] = React.useState<boolean>(false);

  const { width, height } = viewState;

  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const openedEditorModelService = useInjectable<OpenedEditorModelService>(OpenedEditorModelService);
  const { decorationService, labelService, commandService } = openedEditorModelService;

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    openedEditorModelService.handleTreeHandler({
      ...handle,
      getModel: () => openedEditorModelService.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleItemClicked = (ev: React.MouseEvent, item: EditorFile | EditorFileGroup, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleItemClick } = openedEditorModelService;
    if (!item) {
      return;
    }
    handleItemClick(item, type);
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: EditorFile | EditorFileGroup) => {
    const { handleContextMenu } = openedEditorModelService;
    handleContextMenu(ev, node);
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = openedEditorModelService;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handleOuterClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveFileDecoration } = openedEditorModelService;
    enactiveFileDecoration();
  };

  const ensureIsReady = async () => {
    await openedEditorModelService.whenReady;
    if (openedEditorModelService.treeModel) {
      // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
      // 这里需要重新取一下treeModel的值确保为最新的TreeModel
      await openedEditorModelService.treeModel.root.ensureLoaded();
    }
    setIsReady(true);
  };

  React.useEffect(() => {
    ensureIsReady();
    return () => {
      openedEditorModelService.removeFileDecoration();
    };
  }, []);

  React.useEffect(() => {
    const handleBlur = () => {
      openedEditorModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      openedEditorModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  const renderTreeNode = React.useCallback(
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
      return (
        <RecycleTree
          height={height}
          width={width}
          itemHeight={OPEN_EDITOR_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={openedEditorModelService.treeModel}
          placeholder={() => (
            <span className={styles.opened_editor_empty_text}>{localize('opened.editors.empty')}</span>
          )}
        >
          {renderTreeNode}
        </RecycleTree>
      );
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
