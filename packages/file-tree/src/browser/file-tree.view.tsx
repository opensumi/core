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
    height: `${(files.length) * 22}px`,
  };

  const scrollUpHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      setRenderedStart(positionIndex - 8);
    } else {
      setRenderedStart(0);
    }
  };
  const scrollUpThrottledHandler = throttle(scrollUpHanlder, 20);

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      setRenderedStart(positionIndex - 2);
    } else {
      setRenderedStart(0);
    }
  };

  const scrollDownThrottledHandler = throttle(scrollDownHanlder, 200);

  return (
    <div className={ cls(styles.kt_filetree) } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container }>
        <RecycleTree
          dataProvider={ dataProvider }
          multiSelect={ multiSelectable }
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
