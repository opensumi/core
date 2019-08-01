import { Injectable, Autowired } from '@ali/common-di';
import { IFileTreeItem, IFileTreeItemStatus, IFileTreeItemRendered, CONTEXT_MENU } from '@ali/ide-file-tree';
import * as styles from '@ali/ide-file-tree/lib/browser/index.module.less';
import { IFileTreeServiceProps, FileTreeService, FILE_SLASH_FLAG } from '@ali/ide-file-tree/lib/browser';
import { ExpandableTreeNode } from '@ali/ide-core-browser/lib/components';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { observable, action } from 'mobx';
import { DisposableCollection, Disposable, Logger, URI } from '@ali/ide-core-browser';
import { node } from '_@types_prop-types@15.7.1@@types/prop-types';

export abstract class AbstractFileTreeService implements IFileTreeServiceProps {
  toCancelNodeExpansion: DisposableCollection = new DisposableCollection();
  onSelect(files: IFileTreeItem[]) {}
  onDragStart(node: IFileTreeItemRendered, event: React.DragEvent) {}
  onDragOver(node: IFileTreeItemRendered, event: React.DragEvent) {}
  onDragEnter(node: IFileTreeItemRendered, event: React.DragEvent) {}
  onDragLeave(node: IFileTreeItemRendered, event: React.DragEvent) {}
  onDrop(node: IFileTreeItemRendered, event: React.DragEvent) {}
  onContextMenu(nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) {}
  onChange(node: IFileTreeItemRendered, value: string) {}
  draggable = true;
  editable = true;
  multiSelectable = true;
}

const setSelectedTreeNodesAsData = (data: DataTransfer, sourceNode: IFileTreeItemRendered, relatedNodes: IFileTreeItemRendered[]) => {
  setDragableTreeNodeAsData(data, sourceNode);
  setTreeNodeAsData(data, sourceNode);
  data.setData('selected-tree-nodes', JSON.stringify(relatedNodes.map((node) => node.id)));
};

const setDragableTreeNodeAsData = (data: DataTransfer, node: IFileTreeItemRendered) => {
  data.setData('uri', node.uri.toString());
};

const setTreeNodeAsData = (data: DataTransfer, node: IFileTreeItemRendered): void => {
  data.setData('tree-node', node.id.toString());
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

const getNodeById = (nodes: IFileTreeItemRendered[], id: number | string): IFileTreeItemRendered | undefined => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
  }
  return;
};

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
      filestat: {
        ...status[uri].file.filestat,
      },
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

@Injectable()
export class ExplorerResourceService extends AbstractFileTreeService {
  @Autowired(FileTreeService)
  fileTreeService: FileTreeService;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  @Autowired(Logger)
  logger: Logger;

  @observable.shallow
  status: IFileTreeItemStatus = this.fileTreeService.status;

  @observable.shallow

  position: {
    x?: number;
    y?: number;
  } = {};

  private _selectTimer;
  private _selectTimes: number = 0;

  get files() {
    // 不显示跟路径
    return extractFileItemShouldBeRendered(this.fileTreeService.files, this.status).slice(1);
  }

  get root(): URI {
    return this.fileTreeService.root;
  }

  get key() {
    return this.fileTreeService.key;
  }

  @action.bound
  onSelect(files: IFileTreeItem[]) {
    this._selectTimes ++;
    // 单选操作
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (files.length === 1) {
      if (files[0].filestat.isDirectory) {
        this.fileTreeService.updateFilesExpandedStatus(files[0]);
      } else {
        this.fileTreeService.openFile(files[0].uri);
      }
      if (this._selectTimer) {
        clearTimeout(this._selectTimer);
      }
      this._selectTimer = setTimeout(() => {
        // 单击事件
        // 200ms内多次点击默认为双击事件
        if (this._selectTimes > 1) {
          if (!files[0].filestat.isDirectory) {
            this.fileTreeService.openAndFixedFile(files[0].uri);
          }
        }
        this._selectTimes = 0;
      }, 200);
    }
    this.fileTreeService.updateFilesSelectedStatus(files, true);
  }

  @action.bound
  onDragStart(node: IFileTreeItemRendered, event: React.DragEvent) {
    event.stopPropagation();

    let selectedNodes: IFileTreeItem[] = Object.keys(this.status).filter((key: string) => {
      return this.status[key].selected;
    }).map((key) => {
      return this.status[key].file;
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
  }

  @action.bound
  onDragOver(node: IFileTreeItemRendered, event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.toCancelNodeExpansion.disposed) {
      return;
    }
    const timer = setTimeout(() => {
      if (node.filestat.isDirectory) {
        if (!node.expanded) {
          this.fileTreeService.updateFilesExpandedStatus(node);
        }
      }
    }, 500);
    this.toCancelNodeExpansion.push(Disposable.create(() => clearTimeout(timer)));
  }

  @action.bound
  onDragEnter(node: IFileTreeItemRendered, event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.toCancelNodeExpansion.dispose();
    const containing = getContainingDir(node) as IFileTreeItemRendered;
    if (!containing) {
      this.fileTreeService.resetFilesSelectedStatus();
      return;
    }
    const selectNodes = getNodesFromExpandedDir([containing]);
    this.fileTreeService.updateFilesSelectedStatus(selectNodes, true);
  }

  @action.bound
  onDrop(node: IFileTreeItemRendered, event: React.DragEvent) {
    try {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      const containing = getContainingDir(node);
      if (!!containing) {
        const resources = this.getSelectedTreeNodesFromData(event.dataTransfer);
        if (resources.length > 0) {
          for (const treeNode of resources) {
            this.fileTreeService.moveFile(treeNode.uri.toString(), containing.uri.toString());
          }
        }
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  @action.bound
  onContextMenu(nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) {
    const { x, y } = event.nativeEvent;
    let uris;
    this.fileTreeService.updateFilesFocusedStatus(nodes, true);
    if (nodes && nodes.length > 0) {
     uris = nodes.map((node: IFileTreeItemRendered) => node.uri);
    } else {
     uris = [this.root];
    }
    const data = { x, y , uris };
    this.contextMenuRenderer.render(CONTEXT_MENU, data);
    event.stopPropagation();
    event.preventDefault();
  }

  @action.bound
  onChange(node: IFileTreeItemRendered, value: string) {
    if (node.name === TEMP_FILE_NAME) {
      if (node.filestat.isDirectory) {
        this.fileTreeService.createFileFolder(node, value);
      } else {
        this.fileTreeService.createFile(node, value);
      }
    } else {
      this.fileTreeService.renameFile(node, value);
    }
  }

  @action.bound
  getSelectedTreeNodesFromData = (data: DataTransfer) => {
    const resources = data.getData('selected-tree-nodes');
    if (!resources) {
      return [];
    }
    const ids: string[] = JSON.parse(resources);
    return ids.map((id) => getNodeById(this.files, id)).filter((node) => node !== undefined) as IFileTreeItemRendered[];
  }

  /**
   * 文件树定位到对应文件下标
   * @param {URI} uri
   * @memberof FileTreeService
   */
  @action
  async location(uri: URI) {
    const status = this.status[uri.toString()];
    if (!status) {
      // 找不到文件时逐级展开文件夹
      await this.searchAndExpandFileParent(uri, this.status);
      await this.location(uri);
      return;
    }
    const file: IFileTreeItem = status.file;
    const len = this.files.length;
    let index = 0;
    for (; index < len; index++) {
      if (file.id === this.files[index].id) {
        break;
      }
    }
    // 展开的文件中找到的时候
    if (index < len) {
      this.position = {
        y: index,
      };
      this.fileTreeService.updateFilesSelectedStatus([file], true);
    }
  }

  async searchAndExpandFileParent(uri: URI,  staus: IFileTreeItemStatus) {
    const uriStr = uri.toString();
    const uriPathArray = uriStr.split(FILE_SLASH_FLAG);
    let len = uriPathArray.length;
    let parent;
    const expandedQueue: string[] = [];
    while ( len ) {
      parent = uriPathArray.slice(0, len).join(FILE_SLASH_FLAG);
      expandedQueue.push(parent);
      if (staus[parent]) {
        break;
      }
      len--;
    }
    return await this.fileTreeService.updateFilesExpandedStatusByQueue(expandedQueue.slice(1));
  }
}
