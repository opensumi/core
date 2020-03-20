import { action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  CommandService,
  IContextKeyService,
  URI,
  EDITOR_COMMANDS,
  // AppConfig,
  Disposable,
} from '@ali/ide-core-browser';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { IFileTreeAPI } from '../common';
import { FileChange, IFileServiceClient, FileChangeType } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Tree, ITree, WatchEvent, ITreeNodeOrCompositeTreeNode, CompositeTreeNode, IWatcherEvent } from '@ali/ide-components';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { Path } from '@ali/ide-core-common/lib/path';

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

  private _contextMenuContextKeyService: IContextKeyService;

  private cacheNodesMap: Map<string, File | Directory> = new Map();

  // 用于记录文件系统Change事件的定时器
  private eventFlushTimeout: number;
  // 文件系统Change事件队列
  private changeEventDispatchQueue: string[] = [];

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
        // 创建Root节点并引入root文件目录
        const children: any[] = [];
        for (const root of roots) {
          const child = await this.fileTreeAPI.resolveChildren(this as ITree, root);
          this.watchFilesChange(new URI(root.uri));
          this.cacheNodes(children as (File | Directory)[]);
          children.concat(child);
        }
        // TODO: 根据workspace生成临时root托管子目录
        return children;
      } else {
        if (roots.length > 0) {
          const children = await this.fileTreeAPI.resolveChildren(this as ITree, roots[0]);
          this.watchFilesChange(new URI(roots[0].uri));
          this.cacheNodes(children as (File | Directory)[]);
          this.root = children[0];
          return children[0];
        }
      }
    } else {
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
    return !!node && 'filestat' in node && !node.fileStat.isDirectory;
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

  private onFilesChanged(changes: FileChange[]): void {
    if (this.deleteAffectedNodes(this.getDeletedUris(changes))) {
      // 当全部变动均为文件删除时，无需后续刷新操作
      return ;
    }
    if (!this.refreshAffectedNodes(this.getAffectedUris(changes)) && this.isRootAffected(changes)) {
      this.refresh();
    }
  }

  private deleteAffectedNodes(uris: URI[]) {
    const nodes = uris.map((uri) => this.getNodeByUriString(uri.toString())).filter((node) => !!node);
    for (const node of nodes) {
      this.dispatchWatchEvent(node!.parent!.path, { type: WatchEvent.Removed,  path: node!.path });
    }
    return uris.length > 0 && nodes.length === uris.length;
  }

  private dispatchWatchEvent(path: string, event: IWatcherEvent) {
    const watcher = this.root?.watchEvents.get(path);
    if (watcher && watcher.callback) {
      watcher.callback(event);
    }
  }

  refreshAffectedNodes(uris: URI[]) {
    const nodes = this.getAffectedNodes(uris);
    for (const node of nodes) {
      this.refresh(node);
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
    return CompositeTreeNode.is(a) ? -1
      : CompositeTreeNode.is(b)  ? 1
        : 0;
  }

  get contextMenuContextKeyService() {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  // @memoize get contributedContextMenu(): IContextMenu {
  //   return this.registerDispose(this.ctxMenuService.createMenu({
  //     id: MenuId.ExplorerContext,
  //     contextKeyService: this.contextMenuContextKeyService,
  //   }));
  // }

  get isMutiWorkspace(): boolean {
    return !!this.workspaceService.workspace && !this.workspaceService.workspace.isDirectory;
  }

  getDisplayName(uri: URI) {
    return this.workspaceService.getWorkspaceName(uri);
  }

  /**
   * 折叠所有节点
   */
  @action
  collapseAll() {
    // todo
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: Directory = this.root as Directory) {
    if (!Directory.is(node) && node.parent) {
      node = node.parent as Directory;
    }
    this.queueChangeEvent(node.path);
  }

  // 队列化Changed事件
  private queueChangeEvent(path: string) {
    clearTimeout(this.eventFlushTimeout);
    this.eventFlushTimeout = setTimeout(() => this.flushEventQueue(), 150) as any;

    if (this.changeEventDispatchQueue.indexOf(path) === -1) {
      this.changeEventDispatchQueue.push(path);
    }
  }

  public async flushEventQueue() {
    const result: any[] = [];
    if (this.changeEventDispatchQueue.length === 0) {
      return;
    }
    this.changeEventDispatchQueue.sort((pathA, pathB) => {
      const pathADepth = Path.pathDepth(pathA);
      const pathBDepth = Path.pathDepth(pathB);
      return pathADepth - pathBDepth;
    });
    for (const path of this.changeEventDispatchQueue) {
      const watcher = this.root?.watchEvents.get(path);
      if (watcher && typeof watcher.callback === 'function') {
        result.push(await watcher.callback({ type: WatchEvent.Changed, path }));
      }
    }
    // 重置更新队列
    this.changeEventDispatchQueue = [];
    return result;
  }

  // @OnEvent(ResourceLabelOrIconChangedEvent)
  // onResourceLabelOrIconChangedEvent(e: ResourceLabelOrIconChangedEvent) {
  //   // labelService发生改变时，更新icon和名称
  //   this.updateItemMeta(e.payload);
  // }

  @action
  updateItemMeta() {
    // todo
  }

  /**
   * 打开文件
   * @param uri
   */
  openFile(uri: URI) {
    // 当打开模式为双击同时预览模式生效时，默认单击为预览文件
    const preview = this.corePreferences['editor.previewMode'];
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview });
  }

  /**
   * 打开并固定文件
   * @param uri
   */
  openAndFixedFile(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, preview: false });
  }

  /**
   * 在侧边栏打开文件
   * @param {URI} uri
   * @memberof FileTreeService
   */
  openToTheSide(uri: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri, { disableNavigate: true, split: 4 /** right */ });
  }

  /**
   * 比较选中的两个文件
   * @param original
   * @param modified
   */
  compare(original: URI, modified: URI) {
    this.commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
      original,
      modified,
    });
  }
}
