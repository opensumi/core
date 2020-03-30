import { Injectable, Autowired } from '@ali/common-di';
import {
  CommandService,
  IContextKeyService,
  URI,
  EDITOR_COMMANDS,
  // AppConfig,
  Disposable,
  FILE_COMMANDS,
} from '@ali/ide-core-browser';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { IFileTreeAPI } from '../common';
import { FileChange, IFileServiceClient, FileChangeType, FileStat } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Tree, ITree, WatchEvent, ITreeNodeOrCompositeTreeNode, IWatcherEvent, TreeNodeType } from '@ali/ide-components';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Path } from '@ali/ide-core-common/lib/path';
import { observable, action } from 'mobx';
import pSeries = require('p-series');
import { FileContextKey } from './file-contextkey';

export interface IMoveChange {
  source: FileChange;
  target: FileChange;
}

@Injectable()
export class FileTreeService extends Tree {

  // @Autowired(AppConfig)
  // private readonly config: AppConfig;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(FileTreeDecorationService)
  public readonly decorationService: FileTreeDecorationService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(FileContextKey)
  private readonly fileTreeContextKey: FileContextKey;

  private _contextMenuContextKeyService: IContextKeyService;

  private cacheNodesMap: Map<string, File | Directory> = new Map();

  // 用于记录文件系统Change事件的定时器
  private eventFlushTimeout: number;
  // 文件系统Change事件队列
  private changeEventDispatchQueue: string[] = [];

  @observable
  // 筛选模式开关
  filterMode: boolean = false;

  get cacheFiles() {
    return Array.from(this.cacheNodesMap.values());
  }

  async init() {
    await this.workspaceService.roots;
    this.workspaceService.onWorkspaceChanged(async () => {
      this.dispose();
    });

    this.toDispose.push(Disposable.create(() => {
      this.cacheNodesMap.clear();
    }));
  }

  async resolveChildren(parent?: Directory) {
    if (!parent) {
      // 加载根目录
      const roots = await this.workspaceService.roots;

      if (this.isMutiWorkspace) {
        const rootUri = new URI(this.workspaceService.workspace?.uri);
        let rootName = rootUri.displayName;
        rootName = rootName.slice(0, rootName.lastIndexOf('.'));
        const fileStat = {
          ...this.workspaceService.workspace,
          isDirectory: true,
        } as FileStat;
        const root = new Directory(this as ITree, undefined, rootUri, rootName, fileStat);
        // 创建Root节点并引入root文件目录
        this.cacheNodes([root]);
        this.root = root;
        return [root];
      } else {
        if (roots.length > 0) {
          const children = await this.fileTreeAPI.resolveChildren(this as ITree, roots[0]);
          this.watchFilesChange(new URI(roots[0].uri));
          this.cacheNodes(children as (File | Directory)[]);
          this.root = children[0] as Directory;
          return children;
        }
      }
    } else {
      // 根节点加载子节点
      if (Directory.isRoot(parent) && this.isMutiWorkspace) {
        // 加载根目录
        const roots = await this.workspaceService.roots;
        let children: any[] = [];
        for (const fileStat of roots) {
          const child = this.fileTreeAPI.toNode(this as ITree, fileStat, parent);
          this.watchFilesChange(new URI(fileStat.uri));
          children = children.concat(child);
        }
        this.cacheNodes(children as (File | Directory)[]);
        return children;
      }
      // 加载子目录
      if (parent.uri) {
        const children =  await this.fileTreeAPI.resolveChildren(this as ITree, parent.uri.toString(), parent);
        this.cacheNodes(children as (File | Directory)[]);
        return children;
      }
    }
    return [];
  }

  async watchFilesChange(uri: URI) {
    const watcher = await this.fileServiceClient.watchFileChanges(uri);
    this.toDispose.push(watcher);
    watcher.onFilesChanged((changes: FileChange[]) => {
      this.onFilesChanged(changes);
    });
  }

  private isContentFile(node: any | undefined) {
    return !!node && 'filestat' in node && !node.filestat.isDirectory;
  }

  private isFileStatNode(node: object | undefined) {
    return !!node && 'filestat' in node;
  }

  private isFileContentChanged(change: FileChange): boolean {
    return change.type === FileChangeType.UPDATED && this.isContentFile(this.getNodeByUriString(change.uri));
  }

  private getAffectedUris(changes: FileChange[]): URI[] {
    return changes.filter((change) => !this.isFileContentChanged(change)).map((change) => new URI(change.uri));
  }

  private isRootAffected(changes: FileChange[]): boolean {
    const root = this.root;
    if (this.isFileStatNode(root)) {
      return changes.some((change) =>
        change.type < FileChangeType.DELETED && change.uri.toString() === (root as Directory)!.uri.toString(),
      );
    }
    return false;
  }

  private getDeletedUris(changes: FileChange[]): URI[] {
    return changes.filter((change) => change.type === FileChangeType.DELETED).map((change) => new URI(change.uri));
  }

  private getAddedUris(changes: FileChange[]): URI[] {
    return changes.filter((change) => change.type === FileChangeType.ADDED).map((change) => new URI(change.uri));
  }

  private getMoveChange(changes: FileChange[]) {
    changes = changes.slice(0);
    const moveChange: IMoveChange[] = [];
    const restChange = changes.filter((change) => change.type === FileChangeType.UPDATED);
    const deleteOrAddChanges = changes.filter((change) => change.type !== FileChangeType.UPDATED);
    while (deleteOrAddChanges.length >= 2) {
      const change = deleteOrAddChanges.shift();
      let target;
      let source;
      if (change?.type === FileChangeType.DELETED) {
        source = change;
        target = changes.find((change) => change.type === FileChangeType.ADDED && new URI(change.uri).displayName === new URI(source.uri).displayName);
        if (target) {
          moveChange.push({source, target});
        }
      } else if (change?.type === FileChangeType.ADDED) {
        target = change;
        source = changes.find((change) => change.type === FileChangeType.DELETED && new URI(change.uri).displayName === new URI(target.uri).displayName);
        if (source) {
          moveChange.push({source, target});
        }
      }
    }
    return {
      moveChange,
      restChange: restChange.concat(deleteOrAddChanges),
    };
  }

  private async onFilesChanged(changes: FileChange[]) {
    let restChange: FileChange[] = await this.moveAffectedNodes(changes);
    // 移除节点
    restChange = this.deleteAffectedNodes(this.getDeletedUris(restChange), restChange);
    // 添加节点, 需要获取节点类型
    restChange = await this.addAffectedNodes(this.getAddedUris(restChange), restChange);
    if (restChange.length === 0) {
      return ;
    }
    // 处理除了删除/添加/移动事件外的异常事件
    if (!await this.refreshAffectedNodes(this.getAffectedUris(restChange)) && this.isRootAffected(restChange)) {
      await this.refresh();
    }
  }

  private async moveAffectedNodes(changes: FileChange[]) {
    const data = this.getMoveChange(changes);
    const { moveChange, restChange } = data;

    for (const change of moveChange) {
      const node = this.getNodeByUriString(new URI(change.source.uri).parent.toString());
      if (node) {
        await this.moveNode(node, change.source.uri, change.target.uri);
      }
    }
    return restChange;
  }

  public async moveNode(node: File | Directory, source: string, target: string) {
    let rootUri;
    if (!this.isMutiWorkspace) {
      rootUri = this.workspaceService.workspace?.uri;
    } else {
      // 多工作区处理
      rootUri = (await this.workspaceService.roots).find((root) => {
        return new URI(root.uri).isEqualOrParent(node.uri);
      })?.uri;
    }
    if (!rootUri) {
      return;
    }
    const oldRelativePath = new URI(rootUri).relative(new URI(source))!;
    const oldPath = new Path(this.root!.path).join(oldRelativePath?.toString()).toString();
    const newRelativePath = new URI(rootUri).relative(new URI(target))!;
    const newPath = new Path(this.root!.path).join(newRelativePath?.toString()).toString();
    this.dispatchWatchEvent(node!.path, { type: WatchEvent.Moved,  oldPath, newPath });
  }

  public async addNode(node: Directory, newName: string, type: TreeNodeType) {
    const tempFileStat: FileStat = {
      uri: node.uri.resolve(newName).toString(),
      isDirectory: type === TreeNodeType.CompositeTreeNode,
      isSymbolicLink: false,
      lastModification: new Date().getTime(),
    };
    const addNode = await this.fileTreeAPI.toNode(this as ITree, tempFileStat, node as Directory);
    if (!!addNode) {
      // 节点创建失败时，不需要添加
      this.dispatchWatchEvent(node.path, { type: WatchEvent.Added,  node: addNode, id: node.id});
    }
    return addNode;
  }

  private async addAffectedNodes(uris: URI[], changes: FileChange[]) {
    const nodes = uris.map((uri) => {
      return {
        parent: this.getNodeByUriString(uri.parent.toString()),
        uri,
      };
    }).filter((node) => !!node.parent);
    for (const node of nodes) {
      // 一旦更新队列中已包含该文件，临时剔除删除事件传递
      if (!node.parent || this.changeEventDispatchQueue.indexOf(node.parent.path) >= 0) {
        continue ;
      }
      const addNode = await this.fileTreeAPI.resolveNodeByPath(this as ITree, node.uri.toString(), node.parent as Directory);
      if (!!addNode) {
        // 节点创建失败时，不需要添加
        this.dispatchWatchEvent(node.parent.path, { type: WatchEvent.Added,  node: addNode, id: node.parent.id});
      }
    }
    return changes.filter((change) => change.type !== FileChangeType.ADDED);
  }

  public deleteAffectedNodes(uris: URI[], changes: FileChange[] = []) {
    const nodes = uris.map((uri) => this.getNodeByUriString(uri.toString())).filter((node) => !!node);
    for (const node of nodes) {
      // 一旦更新队列中已包含该文件，临时剔除删除事件传递
      if (!node?.parent || this.changeEventDispatchQueue.indexOf(node?.parent.path) >= 0) {
        continue ;
      }
      this.dispatchWatchEvent(node!.parent!.path, { type: WatchEvent.Removed,  path: node!.path });
    }
    return changes.filter((change) => change.type !== FileChangeType.DELETED);
  }

  private dispatchWatchEvent(path: string, event: IWatcherEvent) {
    const watcher = this.root?.watchEvents.get(path);
    if (watcher && watcher.callback) {
      watcher.callback(event);
    }
  }

  async refreshAffectedNodes(uris: URI[]) {
    const nodes = this.getAffectedNodes(uris);
    for (const node of nodes) {
      await this.refresh(node);
    }
    return nodes.length !== 0;
  }

  private getAffectedNodes(uris: URI[]): Directory[] {
    const nodes: Directory[] = [];
    for (const uri of uris) {
      const node = this.getNodeByUriString(uri.parent.toString());
      if (node && Directory.is(node)) {
        nodes.push(node as Directory);
      } else {

      }
    }
    return nodes;
  }

  private cacheNodes(nodes: (File | Directory)[]) {
    // 切换工作区的时候需清理
    nodes.map((node) => {
      this.cacheNodesMap.set(node.uri.toString(), node);
    });
  }

  getNodeByUriString(path: string) {
    return this.cacheNodesMap.get(path);
  }

  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      // numeric 参数确保数字为第一排序优先级
      return a.name.localeCompare(b.name, 'kn', { numeric: true }) as any;
    }
    return a.type === TreeNodeType.CompositeTreeNode ? -1
      : b.type === TreeNodeType.CompositeTreeNode  ? 1
      : 0;
  }

  get contextMenuContextKeyService() {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  public reWatch() {
    // 重连时重新监听文件变化
  }

  get isMutiWorkspace(): boolean {
    return !!this.workspaceService.workspace && !this.workspaceService.workspace.isDirectory;
  }

  getDisplayName(uri: URI) {
    return this.workspaceService.getWorkspaceName(uri);
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: Directory = this.root as Directory) {
    if (!Directory.is(node) && node.parent) {
      node = node.parent as Directory;
    }
    this.queueChangeEvent(node.path, () => {
      this.onNodeRefreshedEmitter.fire(node);
    });

  }

  // 队列化Changed事件
  private queueChangeEvent(path: string, callback: any) {
    clearTimeout(this.eventFlushTimeout);
    this.eventFlushTimeout = setTimeout(async () => {
      await this.flushEventQueue();
      callback();
    }, 150) as any;
    if (this.changeEventDispatchQueue.indexOf(path) === -1) {
      this.changeEventDispatchQueue.push(path);
    }
  }

  public flushEventQueue = () => {
    let promise: Promise<any>;
    if (!this.changeEventDispatchQueue || this.changeEventDispatchQueue.length === 0) {
      return;
    }
    this.changeEventDispatchQueue.sort((pathA, pathB) => {
      const pathADepth = Path.pathDepth(pathA);
      const pathBDepth = Path.pathDepth(pathB);
      return pathADepth - pathBDepth;
    });
    promise = pSeries(this.changeEventDispatchQueue.map((path) => async () => {
      const watcher = this.root?.watchEvents.get(path);
      if (watcher && typeof watcher.callback === 'function') {
        await watcher.callback({ type: WatchEvent.Changed, path });
      }
      return null;
    }));
    // 重置更新队列
    this.changeEventDispatchQueue = [];
    return promise;
  }

  /**
   * 打开文件
   * @param uri
   */
  public openFile(uri: URI) {
    // 当打开模式为双击同时预览模式生效时，默认单击为预览文件
    const preview = this.corePreferences['editor.previewMode'];
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview });
  }

  /**
   * 打开并固定文件
   * @param uri
   */
  public openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview: false });
  }

  /**
   * 在侧边栏打开文件
   * @param {URI} uri
   * @memberof FileTreeService
   */
  public openToTheSide(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, split: 4 /** right */ });
  }

  /**
   * 比较选中的两个文件
   * @param original
   * @param modified
   */
  public compare(original: URI, modified: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
      original,
      modified,
    });
  }

  /**
   * 开关筛选输入框
   */
  @action
  public toggleFilterMode = () => {
    this.filterMode = !this.filterMode;
    this.fileTreeContextKey.filesExplorerFilteredContext.set(this.filterMode);
    this.fileTreeContextKey.filesExplorerFocused.set(!!this.filterMode);
    // 清理掉输入值
    if (this.filterMode === false) {
      // 退出时若需要做 filter 值清理则做聚焦操作
      this.commandService.executeCommand(FILE_COMMANDS.LOCATION.id);
    }
  }

  /**
   * 开启筛选模式
   */
  @action
  public enableFilterMode = () => {
    this.fileTreeContextKey.filesExplorerFilteredContext.set(true);
    this.filterMode = true;
  }

  public locationToCurrentFile = () => {
    this.commandService.executeCommand(FILE_COMMANDS.LOCATION.id);
  }
}
