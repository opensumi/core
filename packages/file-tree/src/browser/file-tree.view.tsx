import * as React from 'react';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItem } from '../common';
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { MenuPath } from '@ali/ide-core-common';
import { IFileTreeServiceProps } from './file-tree.service';
import { useDebounce } from '@ali/ide-core-browser/lib/utils';

export interface IFileTreeItemRendered extends IFileTreeItem {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
}
export interface FileTreeProps extends IFileTreeServiceProps {
  width?: number;
  height?: number;
  treeNodeHeight?: number;
  position?: {
    y?: number | undefined,
    x?: number | undefined,
  };
  files: IFileTreeItem[];
  draggable: boolean;
  editable: boolean;
  multiSelectable: boolean;
  // 预加载数量
  preloadLimit?: number;
  // 是否可搜索
  searchable?: boolean;
  // 搜索文本
  search?: string;
}

export const CONTEXT_MENU: MenuPath = ['filetree-context-menu'];

export const FileTree = ({
  width,
  height,
  treeNodeHeight,
  files,
  position,
  draggable,
  editable,
  preloadLimit,
  multiSelectable,
  onSelect,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onChange,
  onContextMenu,
  searchable,
  search,
}: FileTreeProps) => {
  const FILETREE_LINE_HEIGHT = treeNodeHeight || 22;
  const FILETREE_PRERENDER_NUMBERS = preloadLimit || 10;
  const fileTreeRef = React.createRef<HTMLDivElement>();
  const containerHeight = height && height > 0 ?  height : (fileTreeRef.current && fileTreeRef.current.clientHeight) || 0;
  const containerWidth = width && width > 0 ? width : (fileTreeRef.current && fileTreeRef.current.clientWidth) || 0;
  const [scrollTop, setScrollTop] = React.useState(0);
  const [cacheScrollTop, setCacheScrollTop] = React.useState(0);
  const shouldShowNumbers = containerHeight && Math.ceil(containerHeight / FILETREE_LINE_HEIGHT) || 0;
  const debouncedPostion = useDebounce(position, 200);
  const FileTreeStyle = {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    bottom: 0,
    left: 0,
    width,
    height,
  } as React.CSSProperties;

  const contentHeight = files.length * FILETREE_LINE_HEIGHT;

  const scrollContainerStyle = {
    width: containerWidth,
    height: containerHeight,
  };

  const scrollContentStyle = {
    width: width || 0,
    height: containerHeight ? contentHeight < containerHeight ? containerHeight : contentHeight : 0,
  };

  React.useEffect(() => {
    if (position && typeof position.y === 'number') {
      const locationIndex = position.y;
      let newRenderStart;
      let scrollTop;
      // 保证定位元素在滚动区域正中或可视区域
      // location 功能下对应的Preload节点上下节点数为FILETREE_PRERENDER_NUMBERS/2
      if (locationIndex + Math.ceil(shouldShowNumbers / 2) <= files.length) {
        newRenderStart = locationIndex - Math.ceil((shouldShowNumbers + FILETREE_PRERENDER_NUMBERS) / 2);
        scrollTop = (newRenderStart + FILETREE_PRERENDER_NUMBERS / 2) * FILETREE_LINE_HEIGHT;
      } else {
        // 避免极端情况下，如定位节点为一个满屏列表的最后一个时，上面部分渲染不完整情况
        newRenderStart = locationIndex - shouldShowNumbers;
        scrollTop = (files.length - shouldShowNumbers) * FILETREE_LINE_HEIGHT;
      }
      if (newRenderStart < 0) {
        newRenderStart = 0;
        scrollTop = 0;
      }
      if (cacheScrollTop === scrollTop) {
        // 防止滚动条不同步
        scrollTop += .1;
      }
      setScrollTop(scrollTop);
      setCacheScrollTop(scrollTop);
    }
  }, [debouncedPostion]);

  const fileTreeAttrs = {
    ref: fileTreeRef,
  };

  return (
    <div className={ cls(styles.kt_filetree) } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container } {...fileTreeAttrs} >
        <RecycleTree
          nodes = { files }
          scrollTop = { scrollTop }
          scrollContainerStyle = { scrollContainerStyle }
          scrollContentStyle = { scrollContentStyle }
          onSelect = { onSelect }
          onDragStart = { onDragStart }
          onDragOver = { onDragOver }
          onDragEnter = { onDragEnter }
          onDragLeave = { onDragLeave }
          onChange = { onChange }
          onDrop = { onDrop }
          onContextMenu = { onContextMenu }
          contentNumber = { shouldShowNumbers }
          prerenderNumber = { FILETREE_PRERENDER_NUMBERS }
          itemLineHeight = { FILETREE_LINE_HEIGHT }
          multiSelectable = { multiSelectable }
          draggable = { draggable }
          editable = { editable }
          searchable = { searchable }
          search = { search }
        ></RecycleTree>
      </div>
    </div>
  );
};
