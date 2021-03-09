import { Injectable, Autowired } from '@ali/common-di';
import { TEMP_FILE_NAME, VALIDATE_TYPE, ValidateMessage } from '@ali/ide-core-browser/lib/components';
import { observable, action } from 'mobx';
import {
  DisposableCollection,
  Disposable,
  ILogger,
  URI, Uri,
  IContextKeyService,
  IContextKey,
  Emitter,
  Event,
  FileDecorationsProvider,
  IFileDecoration,
  CorePreferences,
  formatLocalize,
  localize,
  rtrim,
  coalesce,
  isValidBasename,
  trim,
  PreferenceService,
  FILE_COMMANDS,
} from '@ali/ide-core-browser';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';
import { CommandService, memoize } from '@ali/ide-core-common';
import { MenuId, AbstractContextMenuService, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';
import { ExplorerFilteredContext } from '@ali/ide-core-browser/lib/contextkey/explorer';

import { Directory, File } from './file-tree-item';
import { IFileTreeItemRendered } from './file-tree.view';
import { FileContextKey } from './file-contextkey';
import { IFileTreeServiceProps, FileTreeService, IFileTreeItemStatus } from './file-tree.service';
import throttle = require('lodash.throttle');
import * as styles from './index.module.less';

export abstract class AbstractFileTreeService implements IFileTreeServiceProps {
  toCancelNodeExpansion: DisposableCollection = new DisposableCollection();
  onSelect(files: (Directory | File)[]) { }
  onDragStart(node: IFileTreeItemRendered, event: React.DragEvent) { }
  onDragOver(node: IFileTreeItemRendered, event: React.DragEvent) { }
  onDragEnter(node: IFileTreeItemRendered, event: React.DragEvent) { }
  onDragLeave(node: IFileTreeItemRendered, event: React.DragEvent) { }
  onDrop(node: IFileTreeItemRendered, event: React.DragEvent) { }
  onContextMenu(nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) { }
  onChange(node: IFileTreeItemRendered, value: string) { }
  onBlur: () => void;
  onFocus: () => void;
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

const getNodesFromExpandedDir = (container: IFileTreeItemRendered[] = []) => {
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
  themeService: IThemeService,
  files: (Directory | File)[] = [],
  statusMap: IFileTreeItemStatus,
  depth: number = 0,
): IFileTreeItemRendered[] => {
  if (!statusMap) {
    return [];
  }
  let renderedFiles: IFileTreeItemRendered[] = [];
  files.forEach((file: Directory | File) => {
    const statusKey = filetreeService.getStatutsKey(file);
    const status = statusMap.get(statusKey);
    if (status) {
      const isSelected = status.selected;
      const isExpanded = status.expanded;
      const isFocused = status.focused;
      const isCuted = status.cuted;
      const isLoading = status.isLoading;
      const isDropping = status.isDropping;
      let name: string;
      if (filetreeService.isMutiWorkspace) {
        name = depth === 0 ? filetreeService.getDisplayName(file.uri) : file.uri.displayName;
      } else {
        name = file.uri.displayName;
      }
      renderedFiles.push({
        ...file,
        name,
        icon: file.getIcon(isExpanded!),
        filestat: {
          ...status.file.filestat,
        },
        style: isCuted ? { opacity: .5 } as React.CSSProperties : {},
        // 设置拖拽底色
        background: isDropping ? themeService.getColor({ id: 'sideBar.dropBackground' }) || '' : 'inherit',
        depth,
        selected: isSelected,
        expanded: isExpanded,
        focused: isFocused,
        isLoading,
      });
      if (isExpanded && file instanceof Directory) {
        renderedFiles = renderedFiles.concat(extractFileItemShouldBeRendered(filetreeService, themeService, file.children, statusMap, depth + 1));
      }
    }
  });
  return renderedFiles;
};

@Injectable()
export class ExplorerResourceService extends AbstractFileTreeService {

  @Autowired(FileTreeService)
  protected filetreeService: FileTreeService;

  @Autowired(IDecorationsService)
  protected decorationsService: IDecorationsService;

  @Autowired(IContextKeyService)
  protected contextKeyService: IContextKeyService;

  @Autowired(CorePreferences)
  protected corePreferences: CorePreferences;

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(IThemeService)
  public themeService: IThemeService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(FileContextKey)
  private readonly fileContextKey: FileContextKey;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private _locationTarget: URI | undefined = undefined;

  private _nextLocationTarget: URI | undefined = undefined;

  private _currentRelativeUriContextKey: IContextKey<string>;

  private _currentContextUriContextKey: IContextKey<string>;

  private _contextMenuResourceContext: ResourceContextKey;

  private decorationChangeEmitter = new Emitter<any>();
  decorationChangeEvent: Event<any> = this.decorationChangeEmitter.event;

  private themeChangeEmitter = new Emitter<any>();
  themeChangeEvent: Event<any> = this.themeChangeEmitter.event;

  private refreshDecorationEmitter = new Emitter<any>();
  refreshDecorationEvent: Event<any> = this.refreshDecorationEmitter.event;

  @Autowired(ILogger)
  private logger: ILogger;

  @observable
  baseIndent: number;

  @observable
  indent: number;

  @observable.shallow
  position: {
    x?: number;
    y?: number;
  } = {};

  @observable
  // 筛选模式开关
  filterMode: boolean = false;

  // 这里分离出三个值是为了分离input值变化以及其余两种搜索
  // 解决搜索及赋值同时操作存在卡顿问题
  // 前置赋值，后置筛选逻辑
  @observable
  // 筛选关键字
  filter: string = '';

  @observable
  // 路径筛选关键字
  treeFilter: string = '';

  @observable
  // 路径筛选关键字
  pathFilter: string = '';

  private _selectTimer;
  private _selectTimes: number = 0;

  public overrideFileDecorationService: FileDecorationsProvider = {
    getDecoration: (uri, hasChildren = false) => {
      // 转换URI为vscode.uri
      if (uri instanceof URI) {
        uri = Uri.parse(uri.toString());
      }
      return this.decorationsService.getDecoration(uri, hasChildren) as IFileDecoration;
    },
  };

  constructor() {
    super();
    this.init();
  }

  init() {
    this.baseIndent = this.corePreferences['explorer.fileTree.baseIndent'] || 10;
    this.indent = this.corePreferences['explorer.fileTree.indent'] || 6;
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
    // 监听配置变化更新indent
    this.corePreferences.onPreferenceChanged((change) => {
      if (change.preferenceName === 'explorer.fileTree.baseIndent') {
        this.baseIndent = this.corePreferences['explorer.fileTree.baseIndent'];
      } else if (change.preferenceName === 'explorer.fileTree.indent') {
        this.indent = this.corePreferences['explorer.fileTree.indent'];
      }
    });
  }

  @memoize
  get filesExplorerFocused(): IContextKey<boolean> {
    const explorerFocused = ExplorerFilteredContext.bind(this.contextKeyService);
    return explorerFocused;
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

  getFiles = () => {
    let files;
    if (this.filetreeService.isMutiWorkspace) {
      files = extractFileItemShouldBeRendered(this.filetreeService, this.themeService, this.filetreeService.files, this.status);
    } else {
      // 非多工作区不显示跟路径
      files = extractFileItemShouldBeRendered(this.filetreeService, this.themeService, this.filetreeService.files, this.status).slice(1);
    }
    if (this.pathFilter) {
      const filterFilesUris = files
        .filter((file: File | Directory) => {
          return file.uri.toString().indexOf(this.pathFilter) >= 0;
        })
        .map((file) => file.uri);
      files = files.filter((file: File | Directory) => {
        for (const uri of filterFilesUris) {
          if (file.uri.isEqualOrParent(uri)) {
            return true;
          }
        }
        return false;
      });
    }
    return files;
  }

  get root(): URI {
    return this.filetreeService.root;
  }

  get currentRelativeUriContextKey(): IContextKey<string> {
    if (!this._currentRelativeUriContextKey) {
      this._currentRelativeUriContextKey = this.filetreeService.contextMenuContextKeyService.createKey('filetreeContextRelativeUri', '');
    }
    return this._currentRelativeUriContextKey;
  }

  get currentContextUriContextKey(): IContextKey<string> {
    if (!this._currentContextUriContextKey) {
      this._currentContextUriContextKey = this.filetreeService.contextMenuContextKeyService.createKey('filetreeContextUri', '');
    }
    return this._currentContextUriContextKey;
  }

  get contextMenuResourceContext(): ResourceContextKey {
    if (!this._contextMenuResourceContext) {
      this._contextMenuResourceContext = new ResourceContextKey(this.filetreeService.contextMenuContextKeyService);
    }
    return this._contextMenuResourceContext;
  }

  private setContextKeys(file: Directory | File) {
    const isSingleFolder = !this.filetreeService.isMutiWorkspace;
    this.fileContextKey.explorerFolder.set((isSingleFolder && !file) || !!file && Directory.isDirectory(file));
  }

  // 切换 filter 模式，会通过
  toggleFilterMode = () => {
    this.filterMode = !this.filterMode;
    this.filesExplorerFocused.set(!!this.filterMode);
    // 清理掉输入值
    if (this.filterMode === false) {
      // 退出时若需要做 filter 值清理则做聚焦操作
      if (this.filter) {
        this.commandService.executeCommand(FILE_COMMANDS.LOCATION.id);
      }
      this.resetFilter();
    }
  }

  enableFilterMode = () => {
    this.filterMode = true;
  }

  onSelect = (files: (Directory | File)[]) => {
    this._selectTimes++;
    // 单选操作默认先更新选中状态
    this.filetreeService.updateFilesSelectedStatus(files, true);
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (files.length === 1) {
      if (files[0].filestat.isDirectory) {
        if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
          this.loadingFiles(files[0]);
        }
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
          } else {
            if (this.corePreferences['workbench.list.openMode'] === 'doubleClick') {
              this.loadingFiles(files[0]);
            }
          }
        }
        this._selectTimes = 0;
      }, 200);
    }
  }

  onBlur = () => {
    this.filetreeService.isFocused = false;
    this.fileContextKey.filesExplorerFocused.set(false);
  }

  onFocus = () => {
    this.filetreeService.isFocused = true;
    this.fileContextKey.filesExplorerFocused.set(true);
    this.fileContextKey.explorerFocused.set(true);
  }

  async loadingFiles(file: IFileTreeItemRendered) {
    this.filetreeService.updateFileLoadingStatus(file as (Directory | File), true);
    await this.filetreeService.updateFilesExpandedStatus(file as (Directory | File));
    this.filetreeService.updateFileLoadingStatus(file as (Directory | File), false);
  }

  onTwistieClick = (file: IFileTreeItemRendered) => {
    this.loadingFiles(file);
  }

  onDragStart = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.stopPropagation();

    let selectedNodes: IFileTreeItemRendered[] = this.filetreeService.selectedFiles;

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
        label = typeof node.name === 'string' ? node.name : '';
      } else {
        label = String(selectedNodes.length);
      }
      const dragImage = document.createElement('div');
      dragImage.className = styles.filetree_drag_image;
      dragImage.textContent = label;
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, -10, -10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }

  onDragOver = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.toCancelNodeExpansion.disposed) {
      return;
    }
    const timer = setTimeout(() => {
      if (node.filestat.isDirectory) {
        if (!node.expanded) {
          this.loadingFiles(node);
        }
      }
    }, 500);
    this.toCancelNodeExpansion.push(Disposable.create(() => clearTimeout(timer)));
  }

  onDragLeave = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.toCancelNodeExpansion.dispose();
  }

  onDragEnter = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const containing = getContainingDir(node) as IFileTreeItemRendered;
    if (!containing) {
      this.filetreeService.resetFilesSelectedStatus();
      return;
    }
    const selectNodes = getNodesFromExpandedDir([containing]);
    this.filetreeService.updateFilesDroppingStatus(selectNodes, true);
  }

  onDrop = (node: IFileTreeItemRendered, event: React.DragEvent) => {
    try {
      event.preventDefault();
      event.stopPropagation();
      this.filetreeService.resetFilesDroppingStatus();
      event.dataTransfer.dropEffect = 'copy';
      let containing: IFileTreeItemRendered | undefined;
      if (node) {
        containing = getContainingDir(node);
      } else {
        const status = this.getStatus(this.root.toString());
        if (!status) {
          return;
        } else {
          containing = status.file;
        }
      }
      if (!!containing) {
        const resources = this.getSelectedTreeNodesFromData(event.dataTransfer);
        if (resources.length > 0) {
          this.filetreeService.moveFiles(resources.map((res) => res.uri), containing.uri);
        }
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  onContextMenu = (nodes: IFileTreeItemRendered[], event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    let uris: URI[];
    this.filetreeService.updateFilesFocusedStatus(nodes as (Directory | File)[], true);
    if (nodes && nodes.length > 0) {
      uris = nodes.map((node: IFileTreeItemRendered) => node.uri);
    } else {
      uris = [this.root];
    }
    this.setContextKeys(nodes[0] as (Directory | File));
    this.currentContextUriContextKey.set(uris[0].toString());
    this.currentRelativeUriContextKey.set((this.root.relative(uris[0]) || '').toString());
    this.contextMenuResourceContext.set(uris[0]);

    const menus = this.contextMenuService.createMenu({
      id: MenuId.ExplorerContext,
      contextKeyService: this.filetreeService.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [uris[0], uris],
    });
  }

  onChange = (node?: IFileTreeItemRendered, value?: string) => {
    if (!node) {
      this.filetreeService.removeTempStatus();
    } else if (!value) {
      this.filetreeService.removeTempStatus(node as (Directory | File));
    } else if (node && value) {
      if (node.name === TEMP_FILE_NAME) {
        if (node.filestat.isDirectory) {
          this.filetreeService.createFolder(node as (Directory | File), value);
        } else {
          this.filetreeService.createFile(node as (Directory | File), value);
        }
      } else {
        this.filetreeService.renameFile(node as (Directory | File), value);
      }
    }
  }

  getSelectedTreeNodesFromData = (data: DataTransfer) => {
    const resources = data.getData('selected-tree-nodes');
    if (!resources) {
      return [];
    }
    const ids: string[] = JSON.parse(resources);
    const files = this.getFiles();
    return ids.map((id) => getNodeById(files, id)).filter((node) => node !== undefined) as IFileTreeItemRendered[];
  }

  public locationOnShow(uri: URI) {
    this._nextLocationTarget = uri;
  }

  public performLocationOnHandleShow() {
    if (this._nextLocationTarget) {
      this.location(this._nextLocationTarget);
      this._nextLocationTarget = undefined;
    }
  }

  /**
   * 文件树定位到对应文件下标
   * @param {URI} uri
   * @memberof FileTreeService
   */
  async location(uri: URI, disableSelect?: boolean) {
    this._locationTarget = uri;
    // 确保先展开父节点
    const shouldBeLocated = await this.searchAndExpandFileParent(uri, this.root);

    if (!shouldBeLocated) {
      return;
    }

    if (this._locationTarget !== uri) {
      return; // location目标已经改变
    }

    const statusKey = this.filetreeService.getStatutsKey(uri);
    const status = this.status.get(statusKey);

    // 当不存在status及父节点时
    // 定位到根目录顶部
    if (!status || (status.file && !status.file.parent)) {
      this.updatePosition({
        y: 0,
      });
      return;
    }
    const file: Directory | File = status.file;
    let index = 0;
    const files = this.getFiles();
    const len = files.length;
    for (; index < len; index++) {
      if (file.uri.isEqual(files[index].uri)) {
        break;
      }
    }
    // 展开的文件中找到的时候
    if (index < len) {
      this.updatePosition({
        y: index,
      });
      if (!disableSelect) {
        this.filetreeService.updateFilesSelectedStatus([file], true);
      }
    }
  }

  async searchAndExpandFileParent(uri: URI, root: URI): Promise<boolean> {
    const expandedQueue: URI[] = [];
    let parent = uri;
    if (!root.isEqualOrParent(uri)) {
      // 非工作区目录文件，直接结束查找
      return false;
    }
    while (parent && !parent.isEqual(root)) {
      expandedQueue.push(parent);
      parent = parent.parent;
    }
    try {
      await this.filetreeService.updateFilesExpandedStatusByQueue(expandedQueue.slice(1));
    } catch (error) {
      this.logger.error(error && error.stack);
      return false;
    }
    return true;
  }

  onClearClicked = () => {
    this.commandService.executeCommand(FILE_COMMANDS.LOCATION.id);
  }

  protected filterFilesWithPath = throttle(this.doFilterFilesWithPath, 200);

  protected filterFiles = throttle(this.doFilterFiles, 200);

  onFilterChange = (filter: string) => {
    this.filter = filter;
    // 当存在搜索条件时，展开所有存在缓存的文件夹进行匹配
    const isPathFilter = /\//.test(filter);
    if (isPathFilter) {
      this.filterFilesWithPath();
    } else {
      this.filterFiles();
    }
  }

  @action
  resetFilter() {
    this.filter = '';
    this.treeFilter = '';
    this.pathFilter = '';
  }

  @action
  async doFilterFilesWithPath() {
    if (this.filter) {
      await this.filetreeService.expandCachedFolder();
    }
    this.pathFilter = this.filter;
  }

  @action
  async doFilterFiles() {
    // 当利用树组件筛选能力时，需清空pathFilter保证树组件获取到树全集
    this.pathFilter = '';
    if (this.filter) {
      await this.filetreeService.expandCachedFolder();
    }
    this.treeFilter = this.filter;
  }

  @action
  updatePosition(position) {
    this.position = position;
  }

  getWellFormedFileName(filename: string): string {
    if (!filename) {
      return filename;
    }

    // 去除空格
    filename = trim(filename, '\t');

    // 移除尾部的 . / \\
    filename = rtrim(filename, '.');
    filename = rtrim(filename, '/');
    filename = rtrim(filename, '\\');

    return filename;
  }

  trimLongName(name: string): string {
    if (name && name.length > 255) {
      return `${name.substr(0, 255)}...`;
    }
    return name;
  }

  validateFileName = (item: Directory | File, name: string): ValidateMessage | null => {
    // 转换为合适的名称
    name = this.getWellFormedFileName(name);

    // 不存在文件名称
    if (!name || name.length === 0 || /^\s+$/.test(name)) {
      return {
        message: localize('validate.tree.emptyFileNameError'),
        type: VALIDATE_TYPE.ERROR,
      };
    }

    // 不允许开头为分隔符的名称
    if (name[0] === '/' || name[0] === '\\') {
      return {
        message: localize('validate.tree.fileNameStartsWithSlashError'),
        type: VALIDATE_TYPE.ERROR,
      };
    }

    const names = coalesce(name.split(/[\\/]/));
    const parent = item.parent;
    if (name !== item.name) {
      if (parent) {
        // 不允许覆盖已存在的文件
        const child = parent.children.find((child) => child.name === name);
        if (child) {
          return {
            message: formatLocalize('validate.tree.fileNameExistsError', name),
            type: VALIDATE_TYPE.ERROR,
          };
        }
      }

    }
    // 判断子路径是否合法
    if (names.some((folderName) => !isValidBasename(folderName))) {
      return {
        message: formatLocalize('validate.tree.invalidFileNameError', this.trimLongName(name)),
        type: VALIDATE_TYPE.ERROR,
      };
    }

    return null;
  }
}
