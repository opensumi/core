import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState, useInjectable, isOSX, localize } from '@ali/ide-core-browser';
import { RecycleTree, INodeRendererProps, IRecycleTreeHandle, TreeNodeType, Input, Icon } from '@ali/ide-components';
import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import { FileTreeService } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';
import { Directory, File } from './file-tree-nodes';
import { EmptyTreeView } from './empty.view';
import * as cls from 'classnames';
import * as styles from './file-tree.module.less';

export const FILTER_AREA_HEIGHT = 30;
export const FILE_TREE_FIELD_ID = 'FILE_TREE_FIELD';

export const FileTree = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [outerDragOver, setOuterDragOver] = React.useState<boolean>(false);
  const [filter, setFilter ] = React.useState<string>('');
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const { width, height } = viewState;
  const { decorationService, labelService, filterMode, locationToCurrentFile, indent, baseIndent } = useInjectable<FileTreeService>(FileTreeService);
  const fileTreeModelService = useInjectable<FileTreeModelService>(FileTreeModelService);

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
    if (!item) {
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

  const handleTwistierClick = (ev: React.MouseEvent, item: Directory) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { toggleDirectory } = fileTreeModelService;

    toggleDirectory(item);

  };

  React.useEffect(() => {
    ensureIsReady();
    return () => {
      fileTreeModelService.removeFileDecoration();
    };
  }, []);

  const ensureIsReady = async () => {
    await fileTreeModelService.whenReady;
    if (!!fileTreeModelService.treeModel) {
      // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
      // 这里需要重新取一下treeModel的值确保为最新的TreeModel
      await fileTreeModelService.treeModel.root.ensureLoaded();
    }
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

  const handleFocus = () => {
    // 文件树焦点
    const { handleTreeFocus } = fileTreeModelService;
    handleTreeFocus();
  };

  const handleOuterContextMenu = (ev: React.MouseEvent) => {
    const { handleContextMenu } = fileTreeModelService;
    // 空白区域右键菜单
    handleContextMenu(ev);
  };

  const handleOuterDragStart = (ev: React.DragEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
  };

  const handleOuterDragOver = (ev: React.DragEvent) => {
    ev.preventDefault();
    setOuterDragOver(true);
  };

  const handleOuterDragLeave = (ev: React.DragEvent) => {
    setOuterDragOver(false);
  };

  const handleOuterDrop = (ev: React.DragEvent) => {
    const { handleDrop } = fileTreeModelService.dndService;
    setOuterDragOver(false);
    handleDrop(ev);
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: File | Directory) => {
    const { handleContextMenu } = fileTreeModelService;
    handleContextMenu(ev, node);
  };

  const renderFileTree = () => {
    if (isReady) {
      if (!!fileTreeModelService.treeModel) {
        return <RecycleTree
          height={filterMode ? height - FILTER_AREA_HEIGHT : height}
          width={width}
          itemHeight={FILE_TREE_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={fileTreeModelService.treeModel}
          filter={filter}
        >
          {(props: INodeRendererProps) => <FileTreeNode
            item={props.item}
            itemType={props.itemType}
            template={(props as any).template}
            decorationService={decorationService}
            labelService={labelService}
            dndService={fileTreeModelService.dndService}
            decorations={fileTreeModelService.decorations.getDecorations(props.item as any)}
            onClick={handleItemClicked}
            onTwistierClick={handleTwistierClick}
            onContextMenu={handlerContextMenu}
            defaultLeftPadding={baseIndent}
            leftPadding={indent}
          />}
        </RecycleTree>;
      } else {
        return <EmptyTreeView />;
      }
    }
  };

  const renderFilterView = () => {
    const { expandAllCacheDirectory } = fileTreeModelService;
    const handleFilterChange = async (value: string) => {
      if (!!value) {
        await expandAllCacheDirectory();
      }
      setFilter(value);
    };
    const handleAfterClear = () => {
      locationToCurrentFile();
    };

    if (filterMode) {
      return <div className={styles.filter_wrapper} style={{ height: FILTER_AREA_HEIGHT }}>
      <Input
        hasClear
        autoFocus
        size='small'
        onValueChange={handleFilterChange}
        className={styles.filter_input}
        afterClear={handleAfterClear}
        placeholder={localize('file.filetree.filter.placeholder')}
        addonBefore={<Icon className={styles.filterIcon} icon='retrieval' />} />
      </div>;
    }
  };

  return <div
    className={
      cls(styles.file_tree, outerDragOver && styles.outer_drag_over)
    }
    tabIndex={-1}
    ref={wrapperRef}
    onClick={handleOuterClick}
    onFocus={handleFocus}
    onContextMenu={handleOuterContextMenu}
    draggable={true}
    onDragStart={handleOuterDragStart}
    onDragLeave={handleOuterDragLeave}
    onDragOver={handleOuterDragOver}
    onDrop={handleOuterDrop}
    id={FILE_TREE_FIELD_ID}
  >
    {renderFilterView()}
    {renderFileTree()}
  </div>;
});
