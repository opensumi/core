import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState, useInjectable, isOSX, URI } from '@ali/ide-core-browser';
import { RecycleTreeFilterDecorator, RecycleTree, TreeNodeType, INodeRendererWrapProps, IRecycleTreeFilterHandle, TreeModel } from '@ali/ide-components';
import { ProgressBar } from '@ali/ide-core-browser/lib/components/progressbar';
import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import { FileTreeService } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';
import { Directory, File } from '../common/file-tree-node.define';
import * as cls from 'classnames';
import * as styles from './file-tree.module.less';
import { IFileTreeService } from '../common';
import { WelcomeView } from '@ali/ide-main-layout/lib/browser/welcome.view';

export const FILTER_AREA_HEIGHT = 30;
export const FILE_TREE_FILTER_DELAY = 500;

const FilterableRecycleTree = RecycleTreeFilterDecorator(RecycleTree);

export const FileTree = observer(({
  viewState,
}: React.PropsWithChildren<{ viewState: ViewState }>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [outerDragOver, setOuterDragOver] = React.useState<boolean>(false);
  const [filter ] = React.useState<string>('');
  const [model, setModel ] = React.useState<TreeModel>();
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const { width, height } = viewState;

  const { decorationService, labelService, iconService, filterMode, locationToCurrentFile, indent, baseIndent } = useInjectable<FileTreeService>(IFileTreeService);
  const fileTreeModelService = useInjectable<FileTreeModelService>(FileTreeModelService);

  const [iconTheme, setIconTheme ] = React.useState<{
    hasFolderIcons: boolean;
    hasFileIcons: boolean;
    hidesExplorerArrows: boolean;
  }>(iconService.currentTheme || {
    hasFolderIcons: true,
    hasFileIcons: true,
    hidesExplorerArrows: true,
  });

  const hasShiftMask = React.useCallback((event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  }, []);

  const hasCtrlCmdMask = React.useCallback((event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  }, []);

  const handleItemClicked = React.useCallback((event: React.MouseEvent, item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
    // 阻止点击事件冒泡
    event.stopPropagation();

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
      handleItemClick(item, type, activeUri);
    }
  }, []);

  const handleItemDoubleClicked = React.useCallback((event: React.MouseEvent, item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
    // 阻止点击事件冒泡
    event.stopPropagation();

    const { handleItemDoubleClick } = fileTreeModelService;
    if (!item) {
      return;
    }
    handleItemDoubleClick(item, type, activeUri);
  }, []);

  const handleTwistierClick = React.useCallback((ev: React.MouseEvent, item: Directory) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { toggleDirectory } = fileTreeModelService;

    toggleDirectory(item);

  }, []);

  React.useEffect(() => {
    if (isReady) {
      // 首次初始化完成时，设置当前TreeModel，同时监听后续变化，适配工作区变化事件
      setModel(fileTreeModelService.treeModel);
      // 监听工作区变化
      fileTreeModelService.onFileTreeModelChange(async (treeModel) => {
        setIsLoading(true);
        if (!!treeModel) {
          // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
          await treeModel.root.ensureLoaded();
        }
        setModel(treeModel);
        setIsLoading(false);
      });
    }
  }, [isReady]);

  React.useEffect(() => {
    ensureIsReady();
    iconService.onThemeChange((theme) => {
      setIconTheme(theme);
    });
    return () => {
      fileTreeModelService.removeFileDecoration();
    };
  }, []);

  React.useEffect(() => {
    const handleBlur = () => {
      fileTreeModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      fileTreeModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  React.useEffect(() => {
    if (!filterMode) {
      if (fileTreeModelService.fileTreeHandle) {
        fileTreeModelService.fileTreeHandle.clearFilter();
      }
    }
  }, [filterMode]);

  const beforeFilterValueChange = async () => {
    const { expandAllCacheDirectory } = fileTreeModelService;
    await expandAllCacheDirectory();
  };

  const ensureIsReady = async () => {
    await fileTreeModelService.whenReady;
    if (!!fileTreeModelService.treeModel) {
      // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
      // 这里需要重新取一下treeModel的值确保为最新的TreeModel
      await fileTreeModelService.treeModel.root.ensureLoaded();
    }
    setIsReady(true);
  };

  const handleTreeReady = (handle: IRecycleTreeFilterHandle) => {
    fileTreeModelService.handleTreeHandler({
      ...handle,
      getModel: () => fileTreeModelService.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleOuterClick = React.useCallback(() => {
    // 空白区域点击，取消焦点状态
    const { enactiveFileDecoration } = fileTreeModelService;
    enactiveFileDecoration();
  }, []);

  const handleFocus = React.useCallback(() => {
    // 文件树焦点
    const { handleTreeFocus } = fileTreeModelService;
    handleTreeFocus();
  }, []);

  const handleOuterContextMenu = React.useCallback((ev: React.MouseEvent) => {
    const { handleContextMenu } = fileTreeModelService;
    // 空白区域右键菜单
    handleContextMenu(ev);
  }, []);

  const handleOuterDragStart = React.useCallback((ev: React.DragEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
  }, []);

  const handleOuterDragOver = React.useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    setOuterDragOver(true);
  }, []);

  const handleOuterDragLeave = React.useCallback(() => {
    setOuterDragOver(false);
  }, []);

  const handleOuterDrop = React.useCallback((ev: React.DragEvent) => {
    const { handleDrop } = fileTreeModelService.dndService;
    setOuterDragOver(false);
    handleDrop(ev);
  }, []);

  const handlerContextMenu = React.useCallback((ev: React.MouseEvent, node: File | Directory, type: TreeNodeType, activeUri?: URI) => {
    const { handleContextMenu } = fileTreeModelService;
    handleContextMenu(ev, node, activeUri);
  }, []);

  const renderFileTree = () => {
    if (isReady) {
      if (isLoading) {
        return <ProgressBar loading />;
      } else if (!!model) {
        return <FilterableRecycleTree
          height={height}
          width={width}
          itemHeight={FILE_TREE_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model}
          filter={filter}
          filterEnabled={filterMode}
          beforeFilterValueChange={beforeFilterValueChange}
          filterAfterClear={() => locationToCurrentFile()}
          filterAutoFocus={true}
          paddingBottomSize={FILE_TREE_NODE_HEIGHT}
        >
          {(props: INodeRendererWrapProps) => <FileTreeNode
            item={props.item}
            itemType={props.itemType}
            template={(props as any).template}
            decorationService={decorationService}
            labelService={labelService}
            dndService={fileTreeModelService.dndService}
            decorations={fileTreeModelService.decorations.getDecorations(props.item as any)}
            onClick={handleItemClicked}
            onDoubleClick={handleItemDoubleClicked}
            onTwistierClick={handleTwistierClick}
            onContextMenu={handlerContextMenu}
            defaultLeftPadding={baseIndent}
            leftPadding={indent}
            hasPrompt = {props.hasPrompt}
            hasFolderIcons={iconTheme.hasFolderIcons}
            hasFileIcons={iconTheme.hasFileIcons}
            hidesExplorerArrows={iconTheme.hidesExplorerArrows}
          />}
        </FilterableRecycleTree>;
      } else {
        return <WelcomeView viewId='file-explorer-next' />;
      }
    } else {
      return <ProgressBar loading />;
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
  >
    {renderFileTree()}
  </div>;
});
