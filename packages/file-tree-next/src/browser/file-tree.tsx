import cls from 'classnames';
import React, {
  createRef,
  useRef,
  useEffect,
  useCallback,
  useState,
  memo,
  RefObject,
  PropsWithChildren,
  MouseEvent,
  DragEvent,
} from 'react';

import {
  RecycleTreeFilterDecorator,
  RecycleTree,
  TreeNodeType,
  INodeRendererWrapProps,
  IRecycleTreeFilterHandle,
  TreeModel,
} from '@opensumi/ide-components';
import { ViewState, useInjectable, isOSX, URI, DisposableCollection } from '@opensumi/ide-core-browser';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/components/progressbar';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';

import { IFileTreeService } from '../common';
import { Directory, File } from '../common/file-tree-node.define';

import { FileTreeNode, FILE_TREE_NODE_HEIGHT } from './file-tree-node';
import styles from './file-tree.module.less';
import { FileTreeService, ITreeIndent } from './file-tree.service';
import { FileTreeModelService } from './services/file-tree-model.service';


export const FILTER_AREA_HEIGHT = 30;
export const FILE_TREE_FILTER_DELAY = 500;

const FilterableRecycleTree = RecycleTreeFilterDecorator(RecycleTree);

export const FileTree = ({ viewState }: PropsWithChildren<{ viewState: ViewState }>) => {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [outerActive, setOuterActive] = useState<boolean>(false);
  const [outerDragOver, setOuterDragOver] = useState<boolean>(false);
  const [model, setModel] = useState<TreeModel>();
  const wrapperRef: RefObject<HTMLDivElement> = createRef();
  const disposableRef: RefObject<DisposableCollection> = useRef(new DisposableCollection());

  const { height } = viewState;
  const fileTreeService = useInjectable<FileTreeService>(IFileTreeService);
  const {
    iconService,
    locationToCurrentFile,
    filterMode: defaultFilterMode,
    indent: defaultIndent,
    baseIndent: defaultBaseIndent,
  } = fileTreeService;
  const fileTreeModelService = useInjectable<FileTreeModelService>(FileTreeModelService);

  const [treeIndent, setTreeIndent] = useState<ITreeIndent>({
    indent: defaultIndent,
    baseIndent: defaultBaseIndent,
  });
  const [filterMode, setFilterMode] = useState<boolean>(defaultFilterMode);
  const [iconTheme, setIconTheme] = useState<{
    hasFolderIcons: boolean;
    hasFileIcons: boolean;
    hidesExplorerArrows: boolean;
  }>(
    iconService.currentTheme || {
      hasFolderIcons: true,
      hasFileIcons: true,
      hidesExplorerArrows: true,
    },
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
    (event: MouseEvent, item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
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
    },
    [],
  );

  const handleItemDoubleClicked = useCallback(
    (event: MouseEvent, item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
      // 阻止点击事件冒泡
      event.stopPropagation();

      const { handleItemDoubleClick } = fileTreeModelService;
      if (!item) {
        return;
      }
      handleItemDoubleClick(item, type, activeUri);
    },
    [],
  );

  const handleTwistierClick = useCallback((ev: MouseEvent, item: Directory) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { toggleDirectory } = fileTreeModelService;

    toggleDirectory(item);
  }, []);

  useEffect(() => {
    if (isReady) {
      // 首次初始化完成时，设置当前TreeModel，同时监听后续变化，适配工作区变化事件
      setModel(fileTreeModelService.treeModel);
      // 监听工作区变化
      fileTreeModelService.onFileTreeModelChange(async (treeModel) => {
        setIsLoading(true);
        if (treeModel) {
          // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
          await treeModel.root.ensureLoaded();
        }
        setModel(treeModel);
        setIsLoading(false);
      });
    }
  }, [isReady]);

  useEffect(() => {
    ensureIsReady();
    disposableRef.current?.push(
      iconService.onThemeChange((theme) => {
        setIconTheme(theme);
      }),
    );
    disposableRef.current?.push(
      fileTreeService.onTreeIndentChange(({ indent, baseIndent }) => {
        setTreeIndent({ indent, baseIndent });
      }),
    );
    disposableRef.current?.push(
      fileTreeService.onFilterModeChange((flag) => {
        setFilterMode(flag);
      }),
    );
    return () => {
      fileTreeModelService.removeFileDecoration();
      disposableRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      setOuterActive(false);
      fileTreeModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    if (wrapperRef.current) {
      fileTreeService.initContextKey(wrapperRef.current);
    }
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      fileTreeModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  useEffect(() => {
    if (!filterMode) {
      if (fileTreeModelService.fileTreeHandle) {
        fileTreeModelService.fileTreeHandle.clearFilter();
      }
      if (fileTreeModelService.selectedFiles.length === 1) {
        // 单选情况下定位到对应文件或目录
        fileTreeModelService.location(fileTreeModelService.selectedFiles[0].uri);
      }
    }
  }, [filterMode]);

  useEffect(() => {
    const disposeCollection = new DisposableCollection();
    if (model) {
      disposeCollection.push(
        fileTreeModelService.onDidFocusedFileChange((e) => {
          if (e) {
            if (e.isEqual((model?.root as Directory).uri)) {
              if (!outerActive) {
                setOuterActive(!outerActive);
              }
            } else {
              if (outerActive) {
                setOuterActive(!outerActive);
              }
            }
          } else if (!e) {
            if (outerActive) {
              setOuterActive(!outerActive);
            }
          }
        }),
      );
      disposeCollection.push(
        fileTreeModelService.onDidContextMenuFileChange((e) => {
          if (e) {
            if (e.isEqual((model?.root as Directory).uri)) {
              if (!outerActive) {
                setOuterActive(!outerActive);
              }
            } else {
              if (outerActive) {
                setOuterActive(!outerActive);
              }
            }
          } else if (!e) {
            if (outerActive) {
              setOuterActive(!outerActive);
            }
          }
        }),
      );
    }
    return () => {
      disposeCollection.dispose();
    };
  }, [model, outerActive]);

  const beforeFilterValueChange = useCallback(async () => {
    const { expandAllCacheDirectory } = fileTreeModelService;
    await expandAllCacheDirectory();
  }, [fileTreeModelService]);

  const ensureIsReady = useCallback(async () => {
    await fileTreeModelService.whenReady;
    if (fileTreeModelService.treeModel) {
      // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
      // 这里需要重新取一下treeModel的值确保为最新的TreeModel
      await fileTreeModelService.treeModel.root.ensureLoaded();
    }
    if (!disposableRef.current?.disposed) {
      setIsReady(true);
    }
  }, [fileTreeModelService, disposableRef.current]);

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeFilterHandle) => {
      fileTreeModelService.handleTreeHandler({
        ...handle,
        getModel: () => fileTreeModelService.treeModel,
        hasDirectFocus: () => wrapperRef.current === document.activeElement,
      });
    },
    [wrapperRef.current, model],
  );

  const handleOuterClick = useCallback(() => {
    // 空白区域点击，取消焦点状态
    const { handleItemClick } = fileTreeModelService;
    handleItemClick();
  }, []);

  const handleFocus = useCallback(() => {
    // 文件树焦点
    const { handleTreeFocus } = fileTreeModelService;
    handleTreeFocus();
  }, []);

  const handleOuterContextMenu = useCallback((ev: MouseEvent) => {
    const { handleContextMenu } = fileTreeModelService;
    // 空白区域右键菜单
    handleContextMenu(ev);
  }, []);

  const handleOuterDragStart = useCallback((ev: DragEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
  }, []);

  const handleOuterDragOver = useCallback((ev: DragEvent) => {
    ev.preventDefault();
    setOuterDragOver(true);
  }, []);

  const handleOuterDragLeave = useCallback(() => {
    setOuterDragOver(false);
  }, []);

  const handleOuterDrop = useCallback((ev: DragEvent) => {
    const { handleDrop } = fileTreeModelService.dndService;
    setOuterDragOver(false);
    handleDrop(ev);
  }, []);

  const handleContextMenu = useCallback(
    (ev: MouseEvent, node: File | Directory, type: TreeNodeType, activeUri?: URI) => {
      const { handleContextMenu } = fileTreeModelService;
      handleContextMenu(ev, node, activeUri);
    },
    [],
  );

  return (
    <div
      className={cls(styles.file_tree, outerDragOver && styles.outer_drag_over, outerActive && styles.outer_active)}
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
      <FileTreeView
        isLoading={isLoading}
        isReady={isReady}
        height={height}
        model={model}
        iconTheme={iconTheme}
        treeIndent={treeIndent}
        filterMode={filterMode}
        locationToCurrentFile={locationToCurrentFile}
        beforeFilterValueChange={beforeFilterValueChange}
        onTreeReady={handleTreeReady}
        onContextMenu={handleContextMenu}
        onItemClick={handleItemClicked}
        onItemDoubleClick={handleItemDoubleClicked}
        onTwistierClick={handleTwistierClick}
      />
    </div>
  );
};

interface FileTreeViewProps {
  model?: TreeModel;
  isReady: boolean;
  isLoading: boolean;
  height: number;
  filterMode: boolean;
  treeIndent: ITreeIndent;
  iconTheme: {
    hasFolderIcons: boolean;
    hasFileIcons: boolean;
    hidesExplorerArrows: boolean;
  };
  onTreeReady: (handle: IRecycleTreeFilterHandle) => void;
  beforeFilterValueChange: () => Promise<void>;
  locationToCurrentFile: (location: string) => void;
  onItemClick(event: MouseEvent, item: File | Directory, type: TreeNodeType, activeUri?: URI): void;
  onItemDoubleClick(event: MouseEvent, item: File | Directory, type: TreeNodeType, activeUri?: URI): void;
  onContextMenu(ev: MouseEvent, node: File | Directory, type: TreeNodeType, activeUri?: URI): void;
  onTwistierClick(ev: MouseEvent, item: Directory): void;
}

const FileTreeView = memo(
  ({
    isReady,
    isLoading,
    height,
    model,
    filterMode,
    treeIndent,
    iconTheme,
    onTreeReady,
    onItemClick,
    onItemDoubleClick,
    onContextMenu,
    onTwistierClick,
    beforeFilterValueChange,
  }: FileTreeViewProps) => {
    const filetreeService = useInjectable<FileTreeService>(IFileTreeService);
    const { decorationService, labelService, locationToCurrentFile } = filetreeService;
    const fileTreeModelService = useInjectable<FileTreeModelService>(FileTreeModelService);

    // 直接渲染节点不建议通过 Inline 的方式进行渲染
    // 否则每次更新时均会带来比较大的重绘成本
    // 参考：https://github.com/bvaughn/react-window/issues/413#issuecomment-848597993
    const renderFileTreeNode = useCallback(
      (props: INodeRendererWrapProps) => (
        <FileTreeNode
          item={props.item}
          itemType={props.itemType}
          template={(props as any).template}
          decorationService={decorationService}
          labelService={labelService}
          dndService={fileTreeModelService.dndService}
          decorations={fileTreeModelService.decorations.getDecorations(props.item as any)}
          onClick={onItemClick}
          onDoubleClick={onItemDoubleClick}
          onTwistierClick={onTwistierClick}
          onContextMenu={onContextMenu}
          defaultLeftPadding={treeIndent.baseIndent}
          leftPadding={treeIndent.indent}
          hasPrompt={props.hasPrompt}
          hasFolderIcons={iconTheme.hasFolderIcons}
          hasFileIcons={iconTheme.hasFileIcons}
          hidesExplorerArrows={iconTheme.hidesExplorerArrows}
        />
      ),
      [model, treeIndent, iconTheme],
    );

    if (isReady) {
      if (isLoading) {
        return <ProgressBar loading />;
      } else if (model) {
        return (
          <FilterableRecycleTree
            height={height}
            itemHeight={FILE_TREE_NODE_HEIGHT}
            onReady={onTreeReady}
            model={model}
            filterEnabled={filterMode}
            beforeFilterValueChange={beforeFilterValueChange}
            filterAfterClear={locationToCurrentFile}
            filterAutoFocus={true}
            leaveBottomBlank={true}
          >
            {renderFileTreeNode}
          </FilterableRecycleTree>
        );
      } else {
        return <WelcomeView viewId='file-explorer-next' />;
      }
    } else {
      return <ProgressBar loading />;
    }
  },
);

FileTreeView.displayName = 'FileTreeView';
