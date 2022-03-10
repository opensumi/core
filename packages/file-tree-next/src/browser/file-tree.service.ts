import pSeries = require('p-series');

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  Tree,
  ITree,
  WatchEvent,
  ITreeNodeOrCompositeTreeNode,
  IWatcherEvent,
  TreeNodeType,
} from '@opensumi/ide-components';
import {
  CommandService,
  IContextKeyService,
  URI,
  EDITOR_COMMANDS,
  Disposable,
  FILE_COMMANDS,
  PreferenceService,
  Deferred,
  Event,
  Emitter,
  OS,
  IApplicationService,
} from '@opensumi/ide-core-browser';
import { CorePreferences } from '@opensumi/ide-core-browser/lib/core-preferences';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Path } from '@opensumi/ide-core-common/lib/path';
import {
  FileChange,
  IFileServiceClient,
  FileChangeType,
  FileStat,
  IFileServiceWatcher,
} from '@opensumi/ide-file-service/lib/common';
import { IIconService } from '@opensumi/ide-theme';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IFileTreeAPI, IFileTreeService } from '../common';
import { Directory, File } from '../common/file-tree-node.define';

import { FileContextKey } from './file-contextkey';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';

export interface IMoveChange {
  source: FileChange;
  target: FileChange;
}

export interface ITreeIndent {
  indent: number;
  baseIndent: number;
}

@Injectable()
export class FileTreeService extends Tree implements IFileTreeService {
  private static DEFAULT_FLUSH_FILE_EVENT_DELAY = 500;

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

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(FileTreeDecorationService)
  public readonly decorationService: FileTreeDecorationService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(IIconService)
  public readonly iconService: IIconService;

  @Autowired(IApplicationService)
  private readonly appService: IApplicationService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private fileContextKey: FileContextKey;

  private _cacheNodesMap: Map<string, File | Directory> = new Map();

  private _fileServiceWatchers: Map<string, IFileServiceWatcher> = new Map();

  private _cacheIgnoreFileEvent: Map<string, FileChangeType> = new Map();
  private _cacheIgnoreFileEventOnce: URI | null;

  // 用于记录文件系统Change事件的定时器
  private _eventFlushTimeout: number;
  // 文件系统Change事件队列
  private _changeEventDispatchQueue: string[] = [];

  private _roots: FileStat[] | null;

  // 是否进行文件事件监听标志值
  private _readyToWatch = false;
  // 等待监听的路径队列
  private _watchRootsQueue: URI[] = [];

  private _isCompactMode: boolean;

  private willRefreshDeferred: Deferred<void> | null;
  private flushEventQueueDeferred: Deferred<void> | null;

  private requestFlushEventSignalEmitter: Emitter<void> = new Emitter();

  private readonly onWorkspaceChangeEmitter = new Emitter<Directory>();
  private readonly onTreeIndentChangeEmitter = new Emitter<ITreeIndent>();
  private readonly onFilterModeChangeEmitter = new Emitter<boolean>();

  // 筛选模式开关
  private _filterMode = false;
  private _baseIndent: number;
  private _indent: number;

  get filterMode() {
    return this._filterMode;
  }

  get baseIndent() {
    return this._baseIndent;
  }

  get indent() {
    return this._indent;
  }

  get onWorkspaceChange() {
    return this.onWorkspaceChangeEmitter.event;
  }

  get onTreeIndentChange() {
    return this.onTreeIndentChangeEmitter.event;
  }

  get onFilterModeChange() {
    return this.onFilterModeChangeEmitter.event;
  }

  get willRefreshPromise() {
    return this.willRefreshDeferred?.promise;
  }

  get cacheFiles() {
    return Array.from(this._cacheNodesMap.values());
  }

  get requestFlushEventSignalEvent(): Event<void> {
    return this.requestFlushEventSignalEmitter.event;
  }

  get isCompactMode(): boolean {
    return this._isCompactMode;
  }

  set isCompactMode(value: boolean) {
    this._isCompactMode = value;
  }

  get contextKey() {
    return this.fileContextKey;
  }

  async init() {
    this._roots = await this.workspaceService.roots;

    this._baseIndent = this.corePreferences['explorer.fileTree.baseIndent'] || 8;
    this._indent = this.corePreferences['explorer.fileTree.indent'] || 8;
    this._isCompactMode = this.corePreferences['explorer.compactFolders'] as boolean;

    this.toDispose.push(
      this.workspaceService.onWorkspaceChanged((roots) => {
        this._roots = roots;
        // 切换工作区时更新文件树
        const newRootUri = new URI(roots[0].uri);
        const newRoot = new Directory(
          this,
          undefined,
          newRootUri,
          newRootUri.displayName,
          roots[0],
          this.fileTreeAPI.getReadableTooltip(newRootUri),
        );
        this._root = newRoot;
        this.onWorkspaceChangeEmitter.fire(newRoot);
        this.refresh();
      }),
    );

    this.toDispose.push(
      this.workspaceService.onWorkspaceFileExcludeChanged(() => {
        this.refresh();
      }),
    );

    this.toDispose.push(
      Disposable.create(() => {
        this._cacheNodesMap.clear();
        this._roots = null;
      }),
    );

    this.toDispose.push(
      this.corePreferences.onPreferenceChanged((change) => {
        if (change.preferenceName === 'explorer.fileTree.baseIndent') {
          this._baseIndent = (change.newValue as number) || 8;
          this.onTreeIndentChangeEmitter.fire({
            indent: this.indent,
            baseIndent: this.baseIndent,
          });
        } else if (change.preferenceName === 'explorer.fileTree.indent') {
          this._indent = (change.newValue as number) || 8;
          this.onTreeIndentChangeEmitter.fire({
            indent: this.indent,
            baseIndent: this.baseIndent,
          });
        } else if (change.preferenceName === 'explorer.compactFolders') {
          this._isCompactMode = change.newValue as boolean;
          this.refresh();
        }
      }),
    );
  }

  initContextKey(dom: HTMLDivElement) {
    if (!this.fileContextKey) {
      this.fileContextKey = this.injector.get(FileContextKey, [dom]);
    }
  }

  public startWatchFileEvent() {
    this._readyToWatch = true;
    this._watchRootsQueue.forEach(async (uri) => {
      await this.watchFilesChange(uri);
    });
  }

  async resolveChildren(parent?: Directory) {
    let children: (File | Directory)[] = [];
    if (!parent) {
      // 加载根目录
      if (!this._roots) {
        this._roots = await this.workspaceService.roots;
      }
      if (this.isMultipleWorkspace) {
        const rootUri = new URI(this.workspaceService.workspace?.uri);
        let rootName = rootUri.displayName;
        rootName = rootName.slice(0, rootName.lastIndexOf('.'));
        const fileStat = {
          ...this.workspaceService.workspace,
          isDirectory: true,
        } as FileStat;
        const root = new Directory(
          this,
          undefined,
          rootUri,
          rootName,
          fileStat,
          this.fileTreeAPI.getReadableTooltip(rootUri),
        );
        // 创建Root节点并引入root文件目录
        this.cacheNodes([root]);
        this.root = root;
        return [root];
      } else {
        if (this._roots.length > 0) {
          children = await (await this.fileTreeAPI.resolveChildren(this, this._roots[0])).children;
          children.forEach((child) => {
            // 根据workspace更新Root名称
            const rootName = this.workspaceService.getWorkspaceName(child.uri);
            if (rootName && rootName !== child.name) {
              child.updateDisplayName(rootName);
            }
          });
          this.watchFilesChange(new URI(this._roots[0].uri));
          this.cacheNodes(children as (File | Directory)[]);
          this.root = children[0] as Directory;
          return children;
        }
      }
    } else {
      // 根节点加载子节点
      if (Directory.isRoot(parent) && this.isMultipleWorkspace) {
        // 加载根目录
        const roots = await this.workspaceService.roots;
        for (const fileStat of roots) {
          const child = this.fileTreeAPI.toNode(
            this as ITree,
            fileStat,
            parent,
            this.workspaceService.getWorkspaceName(new URI(fileStat.uri)),
          );
          this.watchFilesChange(new URI(fileStat.uri));
          children = children.concat(child);
        }
        this.cacheNodes(children as (File | Directory)[]);
        return children;
      }
      // 加载子目录
      if (parent.uri) {
        const data = await this.fileTreeAPI.resolveChildren(
          this,
          parent.uri.toString(),
          parent,
          this.isCompactMode && !Directory.isRoot(parent),
        );
        children = data.children;
        // 有概率获取不到Filestat，易发生在外部删除多文件情况下
        const childrenParentStat = data.filestat;
        // 需要排除软连接下的直接空目录折叠，否则会导致路径计算错误
        // 但软连接目录下的其他目录不受影响
        if (
          !!childrenParentStat &&
          this.isCompactMode &&
          !parent.filestat.isSymbolicLink &&
          !Directory.isRoot(parent)
        ) {
          const parentURI = new URI(childrenParentStat.uri);
          if (parent && parent.parent) {
            const parentName = (parent.parent as Directory).uri.relative(parentURI)?.toString();
            if (parentName && parentName !== parent.name) {
              const prePath = parent.path;
              this.removeNodeCacheByPath(prePath);
              parent.updateName(parentName);
              parent.updateURI(parentURI);
              parent.updateFileStat(childrenParentStat);
              parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parentURI));
              // Re-Cache Node
              this.reCacheNode(parent, prePath);
            }
          }
        }
        if (children.length > 0) {
          this.cacheNodes(children as (File | Directory)[]);
        }
        return children;
      }
    }
    return [];
  }

  async watchFilesChange(uri: URI) {
    if (!this._readyToWatch) {
      this._watchRootsQueue.push(uri);
      return;
    }
    const watcher = await this.fileServiceClient.watchFileChanges(uri);
    this.toDispose.push(watcher);
    this.toDispose.push(
      watcher.onFilesChanged((changes: FileChange[]) => {
        this.onFilesChanged(changes);
      }),
    );
    this._fileServiceWatchers.set(uri.toString(), watcher);
  }

  private isContentFile(node: any | undefined) {
    return !!node && 'filestat' in node && !node.filestat.isDirectory;
  }

  private isFileContentChanged(change: FileChange): boolean {
    return change.type === FileChangeType.UPDATED && this.isContentFile(this.getNodeByPathOrUri(change.uri));
  }

  private getAffectedUris(changes: FileChange[]): URI[] {
    const affectUrisSet = new Set<string>();
    for (const change of changes) {
      const isFile = this.isFileContentChanged(change);
      if (!isFile) {
        affectUrisSet.add(new URI(change.uri).toString());
      }
    }
    return Array.from(affectUrisSet).map((uri) => new URI(uri));
  }

  private isRootAffected(changes: FileChange[]): boolean {
    if (this._roots) {
      return changes.some(
        (change) =>
          change.type > FileChangeType.UPDATED &&
          this._roots &&
          this._roots.find((root) => change.uri.indexOf(root.uri) >= 0),
      );
    }
    return false;
  }

  private async onFilesChanged(changes: FileChange[]) {
    // 过滤掉内置触发的事件
    if (this._cacheIgnoreFileEventOnce) {
      let filtered = false;
      changes = changes.filter((change) => {
        if (this._cacheIgnoreFileEventOnce!.isEqualOrParent(new URI(change.uri))) {
          filtered = true;
          return false;
        }
        return true;
      });
      if (filtered) {
        this._cacheIgnoreFileEventOnce = null;
      }
    }
    changes = changes.filter((change) => {
      if (!this._cacheIgnoreFileEvent.has(change.uri)) {
        return true;
      } else {
        if (this._cacheIgnoreFileEvent.get(change.uri) === change.type) {
          this._cacheIgnoreFileEvent.delete(change.uri);
          return false;
        }
        return true;
      }
    });
    // 处理除了删除/添加/移动事件外的异常事件
    if (!(await this.refreshAffectedNodes(this.getAffectedUris(changes))) && this.isRootAffected(changes)) {
      this.refresh();
    }
  }

  public async getFileTreeNodePathByUri(uri: URI) {
    // 软链文件在这种情况下无法获取到相对路径
    if (!uri) {
      return;
    }
    let rootStr;
    if (!this.isMultipleWorkspace) {
      rootStr = this.workspaceService.workspace?.uri;
      if (rootStr) {
        const rootUri = new URI(rootStr);
        if (rootUri.isEqualOrParent(uri)) {
          return new Path(this.root?.path || '').join(rootUri.relative(uri)!.toString()).toString();
        }
      }
    } else {
      if (!this._roots) {
        this._roots = await this.workspaceService.roots;
      }
      rootStr = this._roots.find((root) => new URI(root.uri).isEqualOrParent(uri))?.uri;
      if (rootStr) {
        const rootUri = new URI(rootStr);
        if (rootUri.isEqualOrParent(uri)) {
          // 多工作区模式下，路径需要拼接项目名称
          return new Path(this.root?.path || '/')
            .join(rootUri.displayName)
            .join(rootUri.relative(uri)!.toString())
            .toString();
        }
      }
    }
  }

  public async moveNode(node: File | Directory, source: string, target: string) {
    const sourceUri = new URI(source);
    const targetUri = new URI(target);
    const oldPath = await this.getFileTreeNodePathByUri(sourceUri);
    const newPath = await this.getFileTreeNodePathByUri(targetUri);
    // 判断是否为重命名场景，如果是重命名，则不需要刷新父目录
    const shouldReloadParent = sourceUri.parent.isEqual(targetUri.parent) ? false : this.isCompactMode;
    await this.moveNodeByPath(node, oldPath, newPath, shouldReloadParent);
  }

  // 软链接目录下，文件节点路径不能通过uri去获取，存在偏差
  public async moveNodeByPath(node: File | Directory, oldPath?: string, newPath?: string, refreshParent?: boolean) {
    if (oldPath && newPath && newPath !== oldPath) {
      if (!this.isMultipleWorkspace) {
        this._cacheIgnoreFileEvent.set(
          (this.root as Directory).uri.parent.resolve(oldPath.slice(1)).toString(),
          FileChangeType.DELETED,
        );
        this._cacheIgnoreFileEvent.set(
          (this.root as Directory).uri.parent.resolve(newPath.slice(1)).toString(),
          FileChangeType.ADDED,
        );
      }
      this.dispatchWatchEvent(node!.path, { type: WatchEvent.Moved, oldPath, newPath });
      // 压缩模式下，需要尝试更新移动的源节点的父节点及目标节点的目标节点折叠状态
      if (this.isCompactMode) {
        const oldParentPath = new Path(oldPath).dir.toString();
        const newParentPath = new Path(newPath).dir.toString();
        if (oldParentPath) {
          const oldParentNode = this.getNodeByPathOrUri(oldParentPath);
          if (!!oldParentNode && refreshParent) {
            this.refresh(oldParentNode as Directory);
          }
        }
        if (newParentPath) {
          const newParentNode = this.getNodeByPathOrUri(newParentPath);
          const isCompressedFocused = this.contextKeyService.getContextValue('explorerViewletCompressedFocus');
          if (!!newParentNode && isCompressedFocused) {
            this.refresh(newParentNode as Directory);
          }
        }
      }
    }
  }

  public async addNode(node: Directory, newName: string, type: TreeNodeType) {
    let tempFileStat: FileStat;
    let tempName: string;
    const namePaths = Path.splitPath(newName);
    // 处理a/b/c/d这类目录
    if (namePaths.length > 1) {
      let tempUri = node.uri;
      if ((await this.appService.backendOS) === OS.Type.Windows) {
        // Windows环境下会多触发一个UPDATED事件
        this._cacheIgnoreFileEvent.set(tempUri.toString(), FileChangeType.UPDATED);
      }
      for (const path of namePaths) {
        tempUri = tempUri.resolve(path);
        this._cacheIgnoreFileEvent.set(tempUri.toString(), FileChangeType.ADDED);
      }
      if (!this.isCompactMode || Directory.isRoot(node)) {
        tempName = namePaths[0];
      } else {
        if (type === TreeNodeType.CompositeTreeNode) {
          tempName = newName;
        } else {
          tempName = namePaths.slice(0, namePaths.length - 1).join(Path.separator);
        }
      }
    } else {
      tempName = newName;
      if ((await this.appService.backendOS) === OS.Type.Windows) {
        // Windows环境下会多触发一个UPDATED事件
        this._cacheIgnoreFileEvent.set(node.uri.toString(), FileChangeType.UPDATED);
      }
      this._cacheIgnoreFileEvent.set(node.uri.resolve(newName).toString(), FileChangeType.ADDED);
    }
    tempFileStat = {
      uri: node.uri.resolve(tempName).toString(),
      isDirectory: type === TreeNodeType.CompositeTreeNode || namePaths.length > 1,
      isSymbolicLink: false,
      lastModification: new Date().getTime(),
    };
    const addNode = await this.fileTreeAPI.toNode(this as ITree, tempFileStat, node as Directory, tempName);
    if (addNode) {
      this.cacheNodes([addNode]);
      // 节点创建失败时，不需要添加
      this.dispatchWatchEvent(node.path, { type: WatchEvent.Added, node: addNode, id: node.id });
    } else {
      // 新建失败时移除该缓存
      this._cacheIgnoreFileEvent.delete(tempFileStat.uri);
    }
    return addNode;
  }

  // 用于精准删除节点，软连接目录下的文件删除
  public async deleteAffectedNodeByPath(path: string, notRefresh?: boolean) {
    const node = this.getNodeByPathOrUri(path);
    if (node && node.parent) {
      this.removeNodeCacheByPath(node.path);
      // 压缩模式下，刷新父节点目录即可
      if (this.isCompactMode && !notRefresh) {
        this.refresh(node.parent as Directory);
      } else {
        this._cacheIgnoreFileEvent.set(node.uri.toString(), FileChangeType.DELETED);
        this.dispatchWatchEvent(node.parent.path, { type: WatchEvent.Removed, path: node.path });
      }
    }
  }

  public async deleteAffectedNodes(uris: URI[], changes: FileChange[] = []) {
    const nodes: File[] = [];
    for (const uri of uris) {
      const node = this.getNodeByPathOrUri(uri);
      if (node) {
        nodes.push(node as File);
      }
    }
    for (const node of nodes) {
      // 一旦更新队列中已包含该文件，临时剔除删除事件传递
      if (!node?.parent || this._changeEventDispatchQueue.indexOf(node?.parent.path) >= 0) {
        continue;
      }
      await this.deleteAffectedNodeByPath(node.path);
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
    const nodes = await this.getAffectedNodes(uris);
    for (const node of nodes) {
      await this.refresh(node);
    }
    return nodes.length !== 0;
  }

  private async getAffectedNodes(uris: URI[]): Promise<Directory[]> {
    const nodes: Directory[] = [];
    for (const uri of uris) {
      const node = this.getNodeByPathOrUri(uri.parent);
      if (node && Directory.is(node)) {
        nodes.push(node as Directory);
      }
    }
    return nodes;
  }

  ignoreFileEvent(uri: URI, type: FileChangeType) {
    this._cacheIgnoreFileEvent.set(uri.toString(), type);
  }

  ignoreFileEventOnce(uri: URI | null) {
    this._cacheIgnoreFileEventOnce = uri;
  }

  cacheNodes(nodes: (File | Directory)[]) {
    // 切换工作区的时候需清理
    nodes.map((node) => {
      // node.path 不会重复，node.uri在软连接情况下可能会重复
      this._cacheNodesMap.set(node.path, node);
    });
  }

  reCacheNode(node: File | Directory, prePath: string) {
    if (this.root?.watchEvents.has(prePath)) {
      this.root?.watchEvents.set(node.path, this.root?.watchEvents.get(prePath)!);
    }
    this._cacheNodesMap.set(node.path, node);
  }

  removeNodeCacheByPath(path: string) {
    if (this._cacheNodesMap.has(path)) {
      this._cacheNodesMap.delete(path);
    }
  }

  private isFileURI(str: string) {
    return /^file:\/\//.test(str);
  }

  /**
   *
   * @param pathOrUri 路径或者URI对象
   * @param compactMode 是否开启压缩模式查找
   *
   */
  getNodeByPathOrUri(pathOrUri: string | URI) {
    let path: string | undefined;
    let pathURI: URI | undefined;
    if (typeof pathOrUri === 'string' && !this.isFileURI(pathOrUri)) {
      return this._cacheNodesMap.get(pathOrUri);
    }
    if (typeof pathOrUri !== 'string') {
      pathURI = pathOrUri;
      pathOrUri = pathOrUri.toString();
    } else if (this.isFileURI(pathOrUri)) {
      pathURI = new URI(pathOrUri);
    }
    if (this.isFileURI(pathOrUri) && !!pathURI) {
      let rootStr;
      if (!this.isMultipleWorkspace) {
        rootStr = this.workspaceService.workspace?.uri;
      } else if (this._roots) {
        rootStr = this._roots.find((root) => new URI(root.uri).isEqualOrParent(pathURI!))?.uri;
      }
      if (this.root && rootStr) {
        const rootUri = new URI(rootStr);
        if (rootUri.isEqualOrParent(pathURI)) {
          path = new Path(this.root.path).join(rootUri.relative(pathURI)!.toString()).toString();
        }
      }
    }

    if (path) {
      // 压缩模式下查找不到对应节点时，需要查看是否已有包含的文件夹存在
      // 如当收到的变化是 /root/test_folder/test_file，而当前缓存中的路径只有/root/test_folder/test_folder2的情况
      // 需要用当前缓存路径校验是否存在包含关系，这里/root/test_folder/test_folder2与/root/test_folder存在路径包含关系
      // 此时应该重载/root下的文件，将test_folder目录折叠并清理缓存
      if (this.isCompactMode && !this._cacheNodesMap.has(path)) {
        const allNearestPath = Array.from(this._cacheNodesMap.keys()).filter((cache) => cache.indexOf(path!) >= 0);
        let nearestPath;
        for (const nextPath of allNearestPath) {
          const depth = Path.pathDepth(nextPath);
          if (nearestPath) {
            if (depth < nearestPath.depth) {
              nearestPath = {
                path: nextPath,
                depth,
              };
            }
          } else {
            nearestPath = {
              path: nextPath,
              depth,
            };
          }
        }
        if (nearestPath) {
          return this._cacheNodesMap.get(nearestPath.path);
        }
      }
      return this._cacheNodesMap.get(path);
    }
  }

  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      // numeric 参数确保数字为第一排序优先级
      return a.name.localeCompare(b.name, 'kn', { numeric: true }) as any;
    }
    return a.type === TreeNodeType.CompositeTreeNode ? -1 : b.type === TreeNodeType.CompositeTreeNode ? 1 : 0;
  }

  get contextMenuContextKeyService() {
    if (this.fileContextKey) {
      return this.fileContextKey.service;
    } else {
      return this.contextKeyService;
    }
  }

  public reWatch() {
    // 重连时重新监听文件变化
    for (const [uri, watcher] of this._fileServiceWatchers) {
      watcher.dispose();
      this.watchFilesChange(new URI(uri));
    }
  }

  get isMultipleWorkspace(): boolean {
    return !!this.workspaceService.workspace && !this.workspaceService.workspace.isDirectory;
  }

  getDisplayName(uri: URI) {
    return this.workspaceService.getWorkspaceName(uri);
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: Directory = this.root as Directory) {
    this.willRefreshDeferred = new Deferred();
    if (!node) {
      return;
    }
    if (!Directory.is(node) && node.parent) {
      node = node.parent as Directory;
    }
    if (Directory.isRoot(node)) {
      // 根目录刷新时情况忽略队列
      this._cacheIgnoreFileEvent.clear();
    }
    // 这里也可以直接调用node.refresh，但由于文件树刷新事件可能会较多
    // 队列化刷新动作减少更新成本
    this.queueChangeEvent(node.path, () => {
      this.onNodeRefreshedEmitter.fire(node);
      this.willRefreshDeferred?.resolve();
      this.willRefreshDeferred = null;
    });
  }

  // 队列化Changed事件
  private queueChangeEvent(path: string, callback: any) {
    if (!this.flushEventQueueDeferred) {
      clearTimeout(this._eventFlushTimeout);
      this._eventFlushTimeout = setTimeout(async () => {
        this.flushEventQueueDeferred = new Deferred<void>();
        // 询问是否此时可进行刷新事件
        await this.requestFlushEventSignalEmitter.fireAndAwait();
        await this.flushEventQueue();
        this.flushEventQueueDeferred?.resolve();
        this.flushEventQueueDeferred = null;
        callback();
      }, FileTreeService.DEFAULT_FLUSH_FILE_EVENT_DELAY) as any;
    }
    if (this._changeEventDispatchQueue.indexOf(path) === -1) {
      this._changeEventDispatchQueue.push(path);
    }
  }

  public flushEventQueue = () => {
    let promise: Promise<any>;
    if (!this._changeEventDispatchQueue || this._changeEventDispatchQueue.length === 0) {
      return;
    }
    this._changeEventDispatchQueue.sort((pathA, pathB) => {
      // 直接获取节点深度比通过path取深度更可靠
      const pathADepth = this.getNodeByPathOrUri(pathA)?.depth || 0;
      const pathBDepth = this.getNodeByPathOrUri(pathB)?.depth || 0;
      return pathADepth - pathBDepth;
    });
    const roots = [this._changeEventDispatchQueue[0]];
    for (const path of this._changeEventDispatchQueue) {
      if (roots.some((root) => path.indexOf(root) === 0)) {
        continue;
      } else {
        roots.push(path);
      }
    }
    promise = pSeries(
      roots.map((path) => async () => {
        const watcher = this.root?.watchEvents.get(path);
        if (watcher && typeof watcher.callback === 'function') {
          await watcher.callback({ type: WatchEvent.Changed, path });
        }
        return null;
      }),
    );
    // 重置更新队列
    this._changeEventDispatchQueue = [];
    return promise;
  };

  /**
   * 打开文件
   * @param uri
   */
  public openFile(uri: URI) {
    // 当打开模式为双击同时预览模式生效时，默认单击为预览文件
    const preview = this.preferenceService.get<boolean>('editor.previewMode');
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview });
  }

  /**
   * 打开并固定文件
   * @param uri
   */
  public openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, {
      disableNavigate: true,
      preview: false,
      focus: true,
    });
  }

  /**
   * 在侧边栏打开文件
   * @param {URI} uri
   * @memberof FileTreeService
   */
  public openToTheSide(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, {
      disableNavigate: true,
      split: 4 /** right */,
    });
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
  public toggleFilterMode() {
    this._filterMode = !this.filterMode;
    this.onFilterModeChangeEmitter.fire(this.filterMode);
    this.fileContextKey.filesExplorerFilteredContext.set(this.filterMode);
    // 清理掉输入值
    if (this.filterMode === false) {
      // 退出时若需要做 filter 值清理以及聚焦操作
      this.commandService.executeCommand(FILE_COMMANDS.LOCATION.id);
    }
  }

  public locationToCurrentFile = () => {
    this.commandService.executeCommand(FILE_COMMANDS.LOCATION.id);
  };
}
