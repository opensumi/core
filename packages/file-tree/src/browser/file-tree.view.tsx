import * as React from 'react';
import { PerfectScrollbar, TreeContainer, TreeContainerNode, TreeNode, CompositeTreeNode, ExpandableTreeNode} from '@ali/ide-core-browser/lib/components';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import FileTreeService from './file-tree.service';
import { observer } from 'mobx-react-lite';
import { IFileTreeItem, IFileTreeItemStatus } from '../common';
import throttle = require('lodash.throttle');
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';

export interface IFileTreeItemRendered extends IFileTreeItem {
  selected?: boolean;
  expanded?: boolean;
}

export const FileTree = observer(() => {
  const FILETREE_LINE_HEIGHT = 22;
  const FILETREE_PRERENDER_NUMBERS = 10;

  const fileTreeService = useInjectable(FileTreeService);
  const contextMenuRenderer = useInjectable(ContextMenuRenderer);

  const files: IFileTreeItem[] = fileTreeService.files;
  const status: IFileTreeItemStatus = fileTreeService.status;
  const layout = fileTreeService.layout;
  const renderedStart: number = fileTreeService.renderedStart;
  const shouldShowNumbers = Math.ceil(layout.height / FILETREE_LINE_HEIGHT);
  const renderedEnd: number = renderedStart + shouldShowNumbers + FILETREE_PRERENDER_NUMBERS;
  const FileTreeStyle = {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    bottom: 0,
    left: 0,
    width: layout.width,
    height: layout.height,
  } as React.CSSProperties;

  const fileItems: IFileTreeItemRendered[] = extractFileItemShouldBeRendered(files, status);
  let renderedFileItems = fileItems.filter((file: IFileTreeItemRendered, index: number) => {
    return index >= renderedStart && index <= renderedEnd;
  });

  renderedFileItems = renderedFileItems.map((file: IFileTreeItemRendered, index: number) => {
    return {
      ...file,
      order: renderedStart + index,
    };
  });

  const selectHandler = (file: IFileTreeItem) => {
    if (file.filestat.isDirectory) {
      fileTreeService.updateFilesExpandedStatus(file);
    } else {
      fileTreeService.openFile(file.uri);
    }
    fileTreeService.updateFilesSelectedStatus(file);
  };

  const scrollbarStyle = {
    width: layout.width,
    height: layout.height,
  };

  /**
   * 这里定义上下滚动的预加载内容
   * 往上滚动，上列表多渲染8个，下列表多渲染2个
   * 往下滚动，下列表多渲染8个，上列表多渲染2个
   * 引入Magic number 2 和 8
   */
  const scrollerContentStyle = {
    width: layout.width,
    height: `${(fileItems.length) * 22}px`,
  };

  const scrollUpHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      fileTreeService.updateRenderedStart(positionIndex - 8);
    } else {
      fileTreeService.updateRenderedStart(0);
    }
  };
  const handlerScrollUpThrottled = throttle(scrollUpHanlder, 20);

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      fileTreeService.updateRenderedStart(positionIndex - 2);
    } else {
      fileTreeService.updateRenderedStart(0);
    }
  };

  const handlerScrollDownThrottled = throttle(scrollDownHanlder, 200);

  const dragStartHandler = (event: React.DragEvent, node: IFileTreeItemRendered) => {
    console.log(event, node);
  };
  const contextMenuHandler = (event: React.MouseEvent<HTMLElement>, node: IFileTreeItemRendered) => {
    const { x, y } = event.nativeEvent;
    contextMenuRenderer.render(['file'], { x, y });
    event.stopPropagation();
    event.preventDefault();
  };

  return (
    <div className={ cls(styles.kt_tree, styles.kt_filetree) } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container }>
        <PerfectScrollbar
          style={ scrollbarStyle }
          onScrollUp={ handlerScrollUpThrottled }
          onScrollDown={ handlerScrollDownThrottled }
        >
          <div style={ scrollerContentStyle }>
            <TreeContainer
              nodes={ renderedFileItems }
              onContextMenu={ contextMenuHandler }
              onDragStart={ dragStartHandler }
              onSelect={ selectHandler }/>
          </div>
        </PerfectScrollbar>
      </div>
    </div>
  );
});

const extractFileItemShouldBeRendered = (
  files: IFileTreeItem[],
  status: IFileTreeItemStatus,
  depth: number = 0,
): IFileTreeItemRendered[] => {
  let renderedFiles: IFileTreeItemRendered[] = [];
  files.forEach((file: IFileTreeItem) => {
    const isExpanded = status.isExpanded.indexOf(file.id) >= 0;
    const childrens = file.children;
    renderedFiles.push({
      ...file,
      depth,
      selected: file.id === status.isSelected,
      expanded: isExpanded,
    });
    if (isExpanded && childrens && childrens.length > 0) {
      renderedFiles = renderedFiles.concat(extractFileItemShouldBeRendered(file.children, status, depth + 1 ));
    }
  });
  return renderedFiles;
};
