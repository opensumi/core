import * as React from 'react';
import { RecycleTree, ExpandableTreeNode } from '@ali/ide-core-browser/lib/components';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import FileTreeService from './file-tree.service';
import { observer } from 'mobx-react-lite';
import { IFileTreeItem, IFileTreeItemStatus } from '../common';
import throttle = require('lodash.throttle');
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { MenuPath } from '@ali/ide-core-common';

export interface IFileTreeItemRendered extends IFileTreeItem {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
}

// 单选菜单
export const CONTEXT_SINGLE_MENU: MenuPath = ['filetree-context-single-menu'];
// 多选菜单
export const CONTEXT_MUTI_MENU: MenuPath = ['filetree-context-muti-menu'];
// 文件夹菜单
export const CONTEXT_FOLDER_MENU: MenuPath = ['filetree-context-folder-menu'];

export const FileTree = observer(() => {
  const FILETREE_LINE_HEIGHT = 22;
  const FILETREE_PRERENDER_NUMBERS = 10;

  const fileTreeService = useInjectable(FileTreeService);
  const contextMenuRenderer = useInjectable(ContextMenuRenderer);

  const files: IFileTreeItem[] = fileTreeService.files;
  const status: IFileTreeItemStatus = fileTreeService.status;
  const layout = fileTreeService.layout;
  const refreshNodes = fileTreeService.refreshNodes;
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

  const contextMenuHandler = (nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    if (nodes.length === 1) {
      if (ExpandableTreeNode.is(nodes[0])) {
        contextMenuRenderer.render(CONTEXT_FOLDER_MENU, { x, y }, nodes.map((node: IFileTreeItemRendered) => node.uri));
      } else {
        contextMenuRenderer.render(CONTEXT_SINGLE_MENU, { x, y }, nodes.map((node: IFileTreeItemRendered) => node.uri));
      }
    } else {
      contextMenuRenderer.render(CONTEXT_MUTI_MENU, { x, y }, nodes.map((node: IFileTreeItemRendered) => node.uri));
    }
    fileTreeService.updateFilesFocusedStatus(nodes, true);
    event.stopPropagation();
    event.preventDefault();
  };

  let selectTimer;
  let selectTimes = 0;

  const selectHandler = (files: IFileTreeItem[]) => {
    selectTimes ++;
    // 单选操作
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (files.length === 1) {
      if (files[0].filestat.isDirectory) {
        fileTreeService.updateFilesExpandedStatus(files[0]);
      }
      if (selectTimer) {
        clearTimeout(selectTimer);
      }
      selectTimer = setTimeout(() => {
        // 单击事件
        // 200ms内多次点击默认为双击事件
        if (selectTimes === 1) {
          if (!files[0].filestat.isDirectory) {
            fileTreeService.openFile(files[0].uri);
          }
        } else {
          if (!files[0].filestat.isDirectory) {
            fileTreeService.openAndFixedFile(files[0].uri);
          }
        }
        selectTimes = 0;
      }, 200);
    }
    fileTreeService.updateFilesSelectedStatus(files, true);

  };
  const supportMultiSelect = true;

  return (
    <div className={ cls(styles.kt_filetree) } style={ FileTreeStyle } key={ refreshNodes }>
      <div className={ styles.kt_filetree_container }>
        <RecycleTree
          multiSelect={ supportMultiSelect }
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
  if (!status) {
    return [];
  }
  let renderedFiles: IFileTreeItemRendered[] = [];
  files.forEach((file: IFileTreeItem) => {
    const uri = file.filestat.uri.toString();
    const isExpanded = status[uri].expanded;
    const isSelected = status[uri].selected;
    const isFocused = status[uri].focused;
    const childrens = file.children;
    renderedFiles.push({
      ...file,
      depth,
      selected: isSelected,
      expanded: isExpanded,
      focused: isFocused,
    });
    if (isExpanded && childrens && childrens.length > 0) {
      renderedFiles = renderedFiles.concat(extractFileItemShouldBeRendered(file.children, status, depth + 1 ));
    }
  });
  return renderedFiles;
};
