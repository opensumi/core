import * as React from 'react';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
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

  const dataProvider = (): IFileTreeItem[] => {
    let renderedFileItems = fileItems.filter((file: IFileTreeItemRendered, index: number) => {
      return index >= renderedStart && index <= renderedEnd;
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
    width: layout.width,
    height: layout.height,
  };

  const scrollContentStyle = {
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
  const scrollUpThrottledHandler = throttle(scrollUpHanlder, 20);

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / 22);
    if (positionIndex > 8) {
      fileTreeService.updateRenderedStart(positionIndex - 2);
    } else {
      fileTreeService.updateRenderedStart(0);
    }
  };

  const scrollDownThrottledHandler = throttle(scrollDownHanlder, 200);

  const dragStartHandler = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.dataTransfer.setData('uri', node.uri.toString());
  };

  const contextMenuHandler = (node: IFileTreeItemRendered, event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    contextMenuRenderer.render(['file'], { x, y }, [node]);
    event.stopPropagation();
    event.preventDefault();
  };

  const selectHandler = (file: IFileTreeItem) => {
    if (file.filestat.isDirectory) {
      fileTreeService.updateFilesExpandedStatus(file);
    } else {
      fileTreeService.openFile(file.uri);
    }
    fileTreeService.updateFilesSelectedStatus(file);
  };

  return (
    <div className={ cls(styles.kt_filetree) } style={ FileTreeStyle }>
      <div className={ styles.kt_filetree_container }>
        <RecycleTree
          dataProvider={ dataProvider }
          scrollbarStyle={ scrollbarStyle }
          scrollContentStyle={ scrollContentStyle }
          onScrollUp={ scrollUpThrottledHandler }
          onScrollDown={ scrollDownThrottledHandler }
          onSelect={ selectHandler }
          onDragStart={ dragStartHandler }
          onContextMenu={ contextMenuHandler }
        ></RecycleTree>
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
