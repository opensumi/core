import * as React from 'react';
import { RecycleTree, ExpandableTreeNode } from '@ali/ide-core-browser/lib/components';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { FileTreeService } from './file-tree.service';
import { observer } from 'mobx-react-lite';
import { IFileTreeItem, IFileTreeItemStatus } from '../common';
import throttle = require('lodash.throttle');
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { MenuPath, DisposableCollection, Disposable } from '@ali/ide-core-common';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { IFileTreeServiceProps } from './file-tree.service';
export interface IFileTreeItemRendered extends IFileTreeItem {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
}
export interface FileTreeProps extends IFileTreeServiceProps {
  width?: number;
  height?: number;
  position?: {
    y?: number | undefined,
    x?: number | undefined,
  };
  files: IFileTreeItem[];
  draggable: boolean;
  editable: boolean;
  multiSelectable: boolean;
}

// 单选菜单
export const CONTEXT_SINGLE_MENU: MenuPath = ['filetree-context-single-menu'];
// 多选菜单
export const CONTEXT_MULTI_MENU: MenuPath = ['filetree-context-muti-menu'];
// 文件夹菜单
export const CONTEXT_FOLDER_MENU: MenuPath = ['filetree-context-folder-menu'];

export const FileTree = observer(({
  width,
  height,
  files,
  position,
  draggable,
  editable,
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
  const FILETREE_LINE_HEIGHT = 22;
  const FILETREE_PRERENDER_NUMBERS = 10;

  const [renderedStart, setRenderedStart] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const shouldShowNumbers = height && Math.ceil(height / FILETREE_LINE_HEIGHT) || 0;
  const renderedEnd: number = renderedStart + shouldShowNumbers + FILETREE_PRERENDER_NUMBERS;
  const FileTreeStyle = {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    bottom: 0,
    left: 0,
    width,
    height,
  } as React.CSSProperties;

  const dataProvider = (): IFileTreeItem[] => {
    let renderedFileItems = files.filter((file: IFileTreeItemRendered, index: number) => {
      return renderedStart <= index && index <= renderedEnd;
    });

    renderedFileItems = renderedFileItems.map((file: IFileTreeItemRendered, index: number) => {
      return {
        ...file,
        order: renderedStart + index,
      };
    });
    return renderedFileItems;
  };

  const scrollbarStyle = {
    width,
    height,
  };

  const scrollContentStyle = {
    width,
    height: `${(files.length) * FILETREE_LINE_HEIGHT}px`,
  };

  const scrollUpHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / FILETREE_LINE_HEIGHT);
    if (positionIndex > 8) {
      setRenderedStart(positionIndex - 8);
    } else {
      setRenderedStart(0);
    }
  };
  const scrollUpThrottledHandler = throttle(scrollUpHanlder, 200);

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / FILETREE_LINE_HEIGHT);
    if (positionIndex > 8) {
      setRenderedStart(positionIndex - 2);
    } else {
      setRenderedStart(0);
    }
  };

  const scrollDownThrottledHandler = throttle(scrollDownHanlder, 200);

  React.useEffect(() => {
    if (position && position.y) {
      const locationIndex = position.y;
      let newRenderStart;
      // 保证定位元素在滚动区域正中或可视区域
      if (locationIndex + Math.ceil(shouldShowNumbers / 2) <= files.length) {
        newRenderStart = locationIndex - Math.ceil(shouldShowNumbers / 2);
        setScrollTop(newRenderStart * FILETREE_LINE_HEIGHT);
      } else {
        newRenderStart = locationIndex - shouldShowNumbers;
        setScrollTop((files.length - shouldShowNumbers) * FILETREE_LINE_HEIGHT);
      }
      console.log('newRenderStart', newRenderStart);
      if (newRenderStart < 0) {
        newRenderStart = 0;
        setScrollTop(0);
      }
      setRenderedStart(newRenderStart);
    }
  }, [position]);

  return (
    <div className={ cls(styles.kt_filetree) } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container }>
        <RecycleTree
          dataProvider={ dataProvider }
          multiSelect={ multiSelectable }
          scrollTop={ scrollTop }
          scrollbarStyle={ scrollbarStyle }
          scrollContentStyle={ scrollContentStyle }
          onScrollUp={ scrollUpThrottledHandler }
          onScrollDown={ scrollDownThrottledHandler }
          onSelect={ onSelect }
          onDragStart={ onDragStart }
          onDragOver={ onDragOver }
          onDragEnter={ onDragEnter }
          onDragLeave={ onDragLeave }
          onChange = { onChange }
          onDrop={ onDrop }
          draggable={ draggable }
          editable={ editable }
          onContextMenu={ onContextMenu }
        ></RecycleTree>
      </div>
    </div>
  );
});
