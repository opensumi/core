import { Injectable, Autowired } from '@ali/common-di';
import { IFileTreeItem, IFileTreeItemStatus, IFileTreeItemRendered, CONTEXT_MENU } from '@ali/ide-file-tree';
import * as styles from '@ali/ide-file-tree/lib/browser/index.module.less';
import { IFileTreeServiceProps, FileTreeService } from '@ali/ide-file-tree/lib/browser';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { observable, action } from 'mobx';
import { DisposableCollection, Disposable, Logger, URI, Uri, IContextKeyService, IContextKey, Emitter, Event, FileDecorationsProvider, IFileDecoration } from '@ali/ide-core-browser';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';

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
  filetreeService: FileTreeService,
  files: IFileTreeItem[],
  statusMap: IFileTreeItemStatus,
  depth: number = 0,
): IFileTreeItemRendered[] => {
  if (!statusMap) {
    return [];
  }
  let renderedFiles: IFileTreeItemRendered[] = [];
  files.forEach((file: IFileTreeItem) => {
    const uri = filetreeService.getStatutsKey(file);
    const status = statusMap.get(uri);
    if (status) {
      const childrens = file.children;
      const isSelected = status.selected;
      const isExpanded = status.expanded;
      const isFocused = status.focused;
      renderedFiles.push({
        ...file,
        filestat: {
          ...status.file.filestat,
        },
        depth,
        selected: isSelected,
        expanded: isExpanded,
        focused: isFocused,
      });
      if (isExpanded && childrens && childrens.length > 0) {
        renderedFiles = renderedFiles.concat(extractFileItemShouldBeRendered(filetreeService, file.children, statusMap, depth + 1 ));
      }
    }
  });
  return renderedFiles;
};

@Injectable()
export class ExplorerResourceService extends AbstractFileTreeService {

  @Autowired(FileTreeService)
  filetreeService: FileTreeService;

  @Autowired(IDecorationsService)
  decorationsService: IDecorationsService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  private _currentRelativeUriContextKey: IContextKey<string>;

  private _currentContextUriContextKey: IContextKey<string>;

  private decorationChangeEmitter = new Emitter<any>();
  decorationChangeEvent: Event<any> = this.decorationChangeEmitter.event;

  private themeChangeEmitter = new Emitter<any>();
  themeChangeEvent: Event<any> = this.themeChangeEmitter.event;

  private refreshDecorationEmitter = new Emitter<any>();
  refreshDecorationEvent: Event<any> = this.refreshDecorationEmitter.event;

  @Autowired(Logger)
  logger: Logger;

  @observable.shallow
  position: {
    x?: number;
    y?: number;
  } = {};

  private _selectTimer;
  private _selectTimes: number = 0;

  public overrideFileDecorationService: FileDecorationsProvider = {
    getDecoration : (uri, hasChildren = false) => {
      // 转换URI为vscode.uri
      if (uri instanceof URI ) {
        uri = Uri.parse(uri.toString());
      }
      return this.decorationsService.getDecoration(uri, hasChildren) as IFileDecoration;
    },
  };

  constructor() {
    super();
    this.listen();
  }

  listen() {
    // 初始化
    this.themeChangeEmitter.fire(this.themeService);
    this.decorationChangeEmitter.fire(this.overrideFileDecorationService);
    // 监听变化
    this.themeService.onThemeChange(() => {
      this.themeChangeEmitter.fire(this.themeService);
    });
    this.decorationsService.onDidChangeDecorations(() => {
      this.decorationChangeEmitter.fire(this.overrideFileDecorationService);
    });
    // 当status刷新时，通知decorationProvider获取数据
    this.filetreeService.onStatusChange((changes: Uri[]) => {
      this.refreshDecorationEmitter.fire(changes);
    });
  }

  get status() {
    return this.filetreeService.status;
  }

  getStatus(uri: string) {
    let status = this.status.get(uri);
    if (!status) {
      // 当查询不到对应状态时，尝试通过软连接方式获取
      status = this.status.get(uri + '#');
    }
    return status;
  }

  getFiles() {
    if (this.filetreeService.isMutiWorkspace) {
      return extractFileItemShouldBeRendered(this.filetreeService, this.filetreeService.files, this.status);
    } else {
      // 非多工作区不显示跟路径
      return extractFileItemShouldBeRendered(this.filetreeService, this.filetreeService.files, this.status).slice(1);
    }
  }

  get root(): URI {
    return this.filetreeService.root;
  }

  get currentRelativeUriContextKey(): IContextKey<string> {
    if (!this._currentRelativeUriContextKey) {
      this._currentRelativeUriContextKey = this.contextKeyService.createKey('filetreeContextRelativeUri', '');
    }
    return this._currentRelativeUriContextKey;
  }

  get currentContextUriContextKey(): IContextKey<string> {
    if (!this._currentContextUriContextKey) {
      this._currentContextUriContextKey = this.contextKeyService.createKey('filetreeContextUri', '');
    }
    return this._currentContextUriContextKey;
  }

  @action.bound
  onSelect(files: IFileTreeItem[]) {
    this._selectTimes ++;
    // 单选操作
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (files.length === 1) {
      if (files[0].filestat.isDirectory) {
        this.filetreeService.updateFilesExpandedStatus(files[0]);
      } else {
        this.filetreeService.openFile(files[0].uri);
      }
      if (this._selectTimer) {
        clearTimeout(this._selectTimer);
      }
      this._selectTimer = setTimeout(() => {
        // 单击事件
        // 200ms内多次点击默认为双击事件
        if (this._selectTimes > 1) {
          if (!files[0].filestat.isDirectory) {
            this.filetreeService.openAndFixedFile(files[0].uri);
          }
        }
        this._selectTimes = 0;
      }, 200);
    }
    this.filetreeService.updateFilesSelectedStatus(files, true);
  }

  @action.bound
  onDragStart(node: IFileTreeItemRendered, event: React.DragEvent) {
    event.stopPropagation();

    let selectedNodes: IFileTreeItem[] = this.filetreeService.selectedFiles;

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
          this.filetreeService.updateFilesExpandedStatus(node);
        }
      }
    }, 500);
    this.toCancelNodeExpansion.push(Disposable.create(() => clearTimeout(timer)));
  }

  @action.bound
  onDragLeave(node: IFileTreeItemRendered, event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.toCancelNodeExpansion.dispose();
  }

  @action.bound
  onDragEnter(node: IFileTreeItemRendered, event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const containing = getContainingDir(node) as IFileTreeItemRendered;
    if (!containing) {
      this.filetreeService.resetFilesSelectedStatus();
      return;
    }
    const selectNodes = getNodesFromExpandedDir([containing]);
    this.filetreeService.updateFilesSelectedStatus(selectNodes, true);
  }

  @action.bound
  onDrop(node: IFileTreeItemRendered, event: React.DragEvent) {
    try {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      let containing: IFileTreeItemRendered | undefined;
      if (node) {
        containing = getContainingDir(node);
      } else {
        const status = this.getStatus(this.root.toString());
        if (!status) {
          return;
        } else {
          containing = status.file ;
        }
      }
      if (!!containing) {
        const resources = this.getSelectedTreeNodesFromData(event.dataTransfer);
        if (resources.length > 0) {
          for (const treeNode of resources) {
            this.filetreeService.moveFile(treeNode.uri, containing.uri);
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
    this.filetreeService.updateFilesFocusedStatus(nodes, true);
    if (nodes && nodes.length > 0) {
     uris = nodes.map((node: IFileTreeItemRendered) => node.uri);
    } else {
     uris = [this.root];
    }
    const data = { x, y , uris };
    this.currentContextUriContextKey.set(uris[0].toString());
    this.currentRelativeUriContextKey.set((this.root.relative(uris[0]) || '').toString());
    this.contextMenuRenderer.render(CONTEXT_MENU, data);
  }

  @action.bound
  onChange(node?: IFileTreeItemRendered, value?: string) {
    if (!node) {
      this.filetreeService.removeTempStatus();
    } else if (!value) {
      this.filetreeService.removeTempStatus();
    } else if (node && value) {
      if (node.name === TEMP_FILE_NAME) {
        if (node.filestat.isDirectory) {
          this.filetreeService.createFolder(node, value);
        } else {
          this.filetreeService.createFile(node, value);
        }
      } else {
        this.filetreeService.renameFile(node, value);
      }
    }
  }

  @action.bound
  getSelectedTreeNodesFromData = (data: DataTransfer) => {
    const resources = data.getData('selected-tree-nodes');
    if (!resources) {
      return [];
    }
    const ids: string[] = JSON.parse(resources);
    const files = this.getFiles();
    return ids.map((id) => getNodeById(files, id)).filter((node) => node !== undefined) as IFileTreeItemRendered[];
  }

  /**
   * 文件树定位到对应文件下标
   * @param {URI} uri
   * @memberof FileTreeService
   */
  async location(uri: URI) {
    // 确保先展开父节点
    const shouldBeLocated = await this.searchAndExpandFileParent(uri, this.root);

    if (!shouldBeLocated) {
      return;
    }

    const status = this.status.get(uri.toString());

    // 当不存在status及父节点时
    // 定位到根目录顶部
    if (!status || (status.file && !status.file.parent)) {
      this.updatePosition({
        y: 0,
      });
      return;
    }
    const file: IFileTreeItem = status.file;
    let index = 0;
    const files = this.getFiles();
    const len = files.length;
    for (; index < len; index++) {
      if (file.id === files[index].id) {
        break;
      }
    }
    // 展开的文件中找到的时候
    if (index < len) {
      this.updatePosition({
        y: index,
      });
      this.filetreeService.updateFilesSelectedStatus([file], true);
    }
  }

  async searchAndExpandFileParent(uri: URI, root: URI): Promise<boolean> {
    const expandedQueue: URI[] = [];
    let parent = uri;
    if (!root.isEqualOrParent(uri)) {
      // 非工作区目录文件，直接结束查找
      return false;
    }
    while ( parent && !parent.isEqual(root) ) {
      expandedQueue.push(parent);
      parent = parent.parent;
    }
    try {
      await this.filetreeService.updateFilesExpandedStatusByQueue(expandedQueue.slice(0));
    } catch (error) {
      this.logger.error(error && error.stack);
      return false;
    }
    return true;
  }

  @action
  updatePosition(position) {
    this.position = position;
  }
}
