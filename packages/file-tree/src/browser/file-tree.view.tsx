import * as React from 'react';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItem } from '../common';
import { observer } from 'mobx-react-lite';

import throttle = require('lodash.throttle');
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { MenuPath } from '@ali/ide-core-common';
import { IFileTreeServiceProps } from './file-tree.service';
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
}: FileTreeProps) => {
  const FILETREE_LINE_HEIGHT = treeNodeHeight || 22;
  const FILETREE_PRERENDER_NUMBERS = preloadLimit || 10;
  const fileTreeRef = React.createRef<HTMLDivElement>();
  const containerHeight = height && height > 0 ?  height : (fileTreeRef.current && fileTreeRef.current.clientHeight) || 0;
  const containerWidth = width && width > 0 ? width : (fileTreeRef.current && fileTreeRef.current.clientWidth) || 0;
  const [scrollTop, setScrollTop] = React.useState(0);
  const shouldShowNumbers = containerHeight && Math.ceil(containerHeight / FILETREE_LINE_HEIGHT) || 0;
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

  const scrollbarStyle = {
    width: containerWidth,
    height: containerHeight,
  };

  const scrollContentStyle = {
    width,
    height: containerHeight ? contentHeight < containerHeight ? containerHeight : contentHeight : 0,
  };

  React.useEffect(() => {
    if (position && position.y) {
      const locationIndex = position.y;
      let newRenderStart;
      // 保证定位元素在滚动区域正中或可视区域
      // location 功能下对应的Preload节点上下节点数为FILETREE_PRERENDER_NUMBERS/2
      if (locationIndex + Math.ceil(shouldShowNumbers / 2) <= files.length) {
        newRenderStart = locationIndex - Math.ceil((shouldShowNumbers + FILETREE_PRERENDER_NUMBERS) / 2);
        setScrollTop((newRenderStart + FILETREE_PRERENDER_NUMBERS / 2) * FILETREE_LINE_HEIGHT);
      } else {
        // 避免极端情况下，如定位节点为一个满屏列表的最后一个时，上面部分渲染不完整情况
        newRenderStart = locationIndex - shouldShowNumbers;
        setScrollTop((files.length - shouldShowNumbers) * FILETREE_LINE_HEIGHT);
      }
      if (newRenderStart < 0) {
        newRenderStart = 0;
        setScrollTop(0);
      }
    }
  }, [position]);

  const fileTreeAttrs = {
    ref: fileTreeRef,
  };

  return (
    <div className={ cls(styles.kt_filetree) } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container } {...fileTreeAttrs} >
        <RecycleTree
          nodes = { files }
          scrollTop = { scrollTop }
          scrollbarStyle = { scrollbarStyle }
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
        ></RecycleTree>
      </div>
    </div>
  );
};
