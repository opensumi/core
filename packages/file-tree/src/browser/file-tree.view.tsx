import * as React from 'react';
import { RecycleTree, ExpandableTreeNode } from '@ali/ide-core-browser/lib/components';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import FileTreeService from './file-tree.service';
import { observer } from 'mobx-react-lite';
import { IFileTreeItem, IFileTreeItemStatus, FileStatNode } from '../common';
import throttle = require('lodash.throttle');
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { MenuPath, DisposableCollection, Disposable } from '@ali/ide-core-common';

export interface IFileTreeItemRendered extends IFileTreeItem {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
}

// 单选菜单
export const CONTEXT_SINGLE_MENU: MenuPath = ['filetree-context-single-menu'];
// 多选菜单
export const CONTEXT_MULTI_MENU: MenuPath = ['filetree-context-muti-menu'];
// 文件夹菜单
export const CONTEXT_FOLDER_MENU: MenuPath = ['filetree-context-folder-menu'];

export const FileTree = observer(() => {
  const FILETREE_LINE_HEIGHT = 22;
  const FILETREE_PRERENDER_NUMBERS = 10;

  const fileTreeService = useInjectable(FileTreeService);
  const contextMenuRenderer = useInjectable(ContextMenuRenderer);

  const toCancelNodeExpansion = new DisposableCollection();

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

  const contextMenuHandler = (nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    if (nodes.length === 1) {
      if (ExpandableTreeNode.is(nodes[0])) {
        contextMenuRenderer.render(CONTEXT_FOLDER_MENU, { x, y }, nodes.map((node: IFileTreeItemRendered) => node.uri));
      } else {
        contextMenuRenderer.render(CONTEXT_SINGLE_MENU, { x, y }, nodes.map((node: IFileTreeItemRendered) => node.uri));
      }
    } else {
      contextMenuRenderer.render(CONTEXT_MULTI_MENU, { x, y }, nodes.map((node: IFileTreeItemRendered) => node.uri));
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
      } else {
        fileTreeService.openFile(files[0].uri);
      }
      if (selectTimer) {
        clearTimeout(selectTimer);
      }
      selectTimer = setTimeout(() => {
        // 单击事件
        // 200ms内多次点击默认为双击事件
        if (selectTimes > 1) {
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

  const dragStartHandler = (node: IFileTreeItemRendered, event: React.DragEvent) => {

    event.stopPropagation();

    let selectedNodes: IFileTreeItem[] = Object.keys(status).filter((key: string) => {
      return status[key].selected;
    }).map((key) => {
      return status[key].file;
    });
    let isDragWithSelectedNode = false;
    for (const selected of selectedNodes) {
      if (selected && selected.id === node.id) {
        isDragWithSelectedNode = true;
      }
    }
    if (!isDragWithSelectedNode) {
      selectedNodes = [node];
    }

    setSelectedTreeNodesAsData(event.dataTransfer, node, selectedNodes);
    if (event.dataTransfer) {
      let label: string;
      if (selectedNodes.length === 1) {
          label = node.name;
      } else {
          label = String(selectedNodes.length);
      }
      const dragImage = document.createElement('div');
      dragImage.className = styles.kt_filetree_drag_image;
      dragImage.textContent = label;
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, -10, -10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const setDragableTreeNodeAsData = (data: DataTransfer, node: IFileTreeItemRendered) => {
    data.setData('uri', node.uri.toString());
  };

  const setTreeNodeAsData = (data: DataTransfer, node: IFileTreeItemRendered): void => {
    data.setData('tree-node', node.id.toString());
  };

  const setSelectedTreeNodesAsData = (data: DataTransfer, sourceNode: IFileTreeItemRendered, relatedNodes: IFileTreeItemRendered[]) => {
    setDragableTreeNodeAsData(data, sourceNode);
    setTreeNodeAsData(data, sourceNode);
    data.setData('selected-tree-nodes', JSON.stringify(relatedNodes.map((node) => node.id)));
  };

  const getSelectedTreeNodesFromData = (data: DataTransfer) => {
    const resources = data.getData('selected-tree-nodes');
    if (!resources) {
      return [];
    }
    const ids: string[] = JSON.parse(resources);
    return ids.map((id) => getNodeById(fileItems, id)).filter((node) => node !== undefined) as IFileTreeItemRendered[];
  };

  const getNodeById = (nodes: IFileTreeItemRendered[], id: number | string): IFileTreeItemRendered | undefined => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
    }
    return;
  };

  const dragOverHandler = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!toCancelNodeExpansion.disposed) {
      return;
    }
    const timer = setTimeout(() => {
      if (node.filestat.isDirectory) {
        if (!node.expanded) {
          fileTreeService.updateFilesExpandedStatus(node);
        }
      }
    }, 500);
    toCancelNodeExpansion.push(Disposable.create(() => clearTimeout(timer)));
  };

  const dragEnterHandler = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toCancelNodeExpansion.dispose();
    const container = getContainingDir(node) as IFileTreeItemRendered;
    if (!container) { return; }
    const selectNodes = getNodesFromExpandedDir([container]);
    fileTreeService.updateFilesSelectedStatus(selectNodes, true);
  };

  const dropHandler = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    try {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const containing = getContainingDir(node);
      if (!!containing) {
        const resources = getSelectedTreeNodesFromData(event.dataTransfer);
        if (resources.length > 0) {
          for (const treeNode of resources) {
            fileTreeService.moveFile(treeNode.uri.toString(), containing.uri.toString());
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getNodesFromExpandedDir = (container: IFileTreeItem[]) => {
    let result: any = [];
    if (!container) {
      return result;
    }
    container.forEach((node) => {
      result.push(node);
      const children = node.children;
      if (!!node && Array.isArray(children)) {
        result = result.concat(getNodesFromExpandedDir(children));
      }
    });
    return result;
  };

  const getContainingDir = (node: IFileTreeItemRendered) => {
    let container: IFileTreeItemRendered | undefined = node;
    while (!!container && container.filestat) {
      if (container.filestat.isDirectory) {
        break;
      }
      container = container.parent;
    }
    return container;
  };

  const dragLeaveHandler = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toCancelNodeExpansion.dispose();
  };

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
          onDragOver={ dragOverHandler }
          onDragEnter={ dragEnterHandler }
          onDragLeave={ dragLeaveHandler }
          onDrop={ dropHandler }
          draggable={ true }
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
    if (!status[uri]) {
      return;
    }
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
