import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState, useInjectable, isOSX } from '@ali/ide-core-browser';
import * as styles from './file-tree.module.less';
import { RecycleTree, INodeRendererProps, IRecycleTreeHandle, TreeNodeType } from '@ali/ide-components';
import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import { FileTreeService } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';
import { Directory, File } from './file-tree-nodes';

export const FileTree = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [isEdited ] = React.useState<boolean>(false);
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const { width, height } = viewState;
  const { decorationService, labelService } = useInjectable<FileTreeService>(FileTreeService);

  const fileTreeModelService = useInjectable<FileTreeModelService>(FileTreeModelService);
  const { validateMessage } = fileTreeModelService;

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

  const handleItemClicked = (ev: React.MouseEvent, item: File | Directory, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleItemClick, handleItemToggleClick, handleItemRangeClick } = fileTreeModelService;
    if (!item || isEdited) {
      return;
    }
    const shiftMask = hasShiftMask(event);
    const ctrlCmdMask = hasCtrlCmdMask(event);
    if (shiftMask) {
      handleItemRangeClick(item, type);
    } else if (ctrlCmdMask) {
      handleItemToggleClick(item, type);
    } else {
      handleItemClick(item, type);
    }
  };

  React.useEffect(() => {
    ensureIsReady();
    return () => {
      fileTreeModelService.removeFileDecoration();
    };
  }, []);

  const ensureIsReady = async () => {
    await fileTreeModelService.whenReady;
    // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
    // 这里需要重新取一下treeModel的值确保为最新的TreeModel
    await fileTreeModelService.treeModel.root.ensureLoaded;
    setIsReady(true);
  };

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    fileTreeModelService.handleTreeHandler({
      ...handle,
      getModel: () => fileTreeModelService.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleOuterClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveFileDecoration } = fileTreeModelService;
    enactiveFileDecoration();
  };

  const handleBlur = () => {
    // 文件树失去焦点
    const { enactiveFileDecoration } = fileTreeModelService;
    enactiveFileDecoration();
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = fileTreeModelService;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: File | Directory) => {
    const { handleContextMenu } = fileTreeModelService;
    handleContextMenu(ev, node);
  };

  const renderFileTree = () => {
    if (isReady) {
      return <RecycleTree
        height={height}
        width={width}
        itemHeight={FILE_TREE_NODE_HEIGHT}
        onReady={handleTreeReady}
        model={fileTreeModelService.treeModel}
      >
        {(props: INodeRendererProps) => <FileTreeNode
          item={props.item}
          itemType={props.itemType}
          decorationService={decorationService}
          labelService={labelService}
          validateMessage={validateMessage}
          dndService={fileTreeModelService.dndService}
          decorations={fileTreeModelService.decorations.getDecorations(props.item as any)}
          onClick={handleItemClicked}
          onContextMenu={handlerContextMenu}
        />}
      </RecycleTree>;
    }
  };

  return <div
    className={styles.file_tree}
    tabIndex={-1}
    ref={wrapperRef}
    onClick={handleOuterClick}
    onBlur={handleBlur}
    onContextMenu={handleOuterContextMenu}
  >
    {renderFileTree()}
  </div>;
});
