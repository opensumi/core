/* eslint-disable @typescript-eslint/prefer-for-of */
import {
  Event,
  Emitter,
  DisposableCollection,
  path,
  CancellationToken,
  CancellationTokenSource,
  isUndefined,
  ThrottledDelayer,
} from '@opensumi/ide-utils';

import {
  IWatcherCallback,
  IWatchTerminator,
  IWatcherInfo,
  ITreeNodeOrCompositeTreeNode,
  ITreeNode,
  ICompositeTreeNode,
  TreeNodeEvent,
  IWatcherEvent,
  MetadataChangeType,
  ITreeWatcher,
  IMetadataChange,
  ITree,
  WatchEvent,
  TreeNodeType,
  IAccessibilityInformation,
} from '../types';

const { Path } = path;
/**
 * 裁剪数组
 *
 * @param arr 裁剪数组
 * @param start 起始位置
 * @param deleteCount 删除或替换位置
 * @param items 插入的数组
 */
export function spliceArray(arr: number[], start: number, deleteCount = 0, items?: number[] | null) {
  const a = arr.slice(0);
  a.splice(start, deleteCount, ...(items || []));
  return a;
}

export enum BranchOperatorStatus {
  EXPANDED = 1,
  SHRINKED,
}

export type TreeNodeOrCompositeTreeNode = TreeNode | CompositeTreeNode;

export interface IGlobalTreeState {
  isExpanding: boolean;
  isLoadingPath: boolean;
  isRefreshing: boolean;
  refreshCancelToken: CancellationTokenSource;
  loadPathCancelToken: CancellationTokenSource;
}

export interface IOptionalGlobalTreeState {
  isExpanding?: boolean;
  isLoadingPath?: boolean;
  isRefreshing?: boolean;
  refreshCancelToken?: CancellationTokenSource;
  loadPathCancelToken?: CancellationTokenSource;
}

export class TreeNode implements ITreeNode {
  public static nextId = (() => {
    let id = 0;
    return () => id++;
  })();

  public static is(node: any): node is ITreeNode {
    return !!node && 'depth' in node && 'name' in node && 'path' in node && 'id' in node;
  }

  public static getTreeNodeById(id: number) {
    return TreeNode.idToTreeNode.get(id);
  }

  public static getTreeNodeByPath(path: string) {
    return TreeNode.pathToTreeNode.get(path);
  }

  public static setTreeNode(id: number, path: string, node: TreeNode) {
    TreeNode.idToTreeNode.set(id, node);
    TreeNode.pathToTreeNode.set(path, node);
  }

  public static removeTreeNode(id: number, path: string) {
    TreeNode.idToTreeNode.delete(id);
    TreeNode.pathToTreeNode.delete(path);
  }

  public static getIdByPath(path: string) {
    return TreeNode.pathToId.get(path);
  }

  public static setIdByPath(path: string, id: number) {
    return TreeNode.pathToId.set(path, id);
  }

  public static getGlobalTreeState(path: string) {
    let state = TreeNode.pathToGlobalTreeState.get(path);
    if (!state) {
      state = {
        isExpanding: false,
        isLoadingPath: false,
        isRefreshing: false,
        refreshCancelToken: new CancellationTokenSource(),
        loadPathCancelToken: new CancellationTokenSource(),
      };
    }
    return state;
  }

  public static setGlobalTreeState(path: string, updateState: IOptionalGlobalTreeState) {
    let state = TreeNode.pathToGlobalTreeState.get(path);
    if (!state) {
      state = {
        isExpanding: false,
        isLoadingPath: false,
        isRefreshing: false,
        refreshCancelToken: new CancellationTokenSource(),
        loadPathCancelToken: new CancellationTokenSource(),
      };
    }
    state = {
      ...state,
      ...updateState,
    };
    TreeNode.pathToGlobalTreeState.set(path, state);
    return state;
  }

  public static idToTreeNode: Map<number, ITreeNodeOrCompositeTreeNode> = new Map();
  public static pathToTreeNode: Map<string, ITreeNodeOrCompositeTreeNode> = new Map();
  public static pathToId: Map<string, number> = new Map();
  // 每颗树都只会在根节点上绑定一个可取消的对象，即同个时间点只能存在一个改变树数据结构的事情
  private static pathToGlobalTreeState: Map<string, IGlobalTreeState> = new Map();

  private _parent: ICompositeTreeNode | undefined;

  private _metadata: {
    [key: string]: any;
  };

  private _uid: number;
  private _disposed: boolean;

  protected _depth: number;
  protected _watcher: ITreeWatcher;
  protected _tree: ITree;
  protected _visible: boolean;

  protected constructor(
    tree: ITree,
    parent?: ICompositeTreeNode,
    watcher?: ITreeWatcher,
    optionalMetadata?: { [key: string]: any },
  ) {
    this._uid = TreeNode.nextId();
    this._parent = parent;
    this._tree = tree;
    this._disposed = false;
    this._visible = true;
    this._metadata = { ...(optionalMetadata || {}) };
    this._depth = parent ? parent.depth + 1 : 0;
    if (watcher) {
      this._watcher = watcher;
    } else if (parent) {
      this._watcher = (parent as any).watcher;
    }
  }

  get disposed() {
    return this._disposed;
  }

  /**
   * 获取基础信息
   */
  get depth() {
    return this._depth;
  }

  get parent() {
    return this._parent;
  }

  set parent(node: ICompositeTreeNode | undefined) {
    this._parent = node;
  }

  get type() {
    return TreeNodeType.TreeNode;
  }

  get id() {
    return this._uid;
  }

  set id(id: number) {
    this._uid = id;
  }

  get displayName() {
    return this.name;
  }

  /**
   * 由于 Tree 对于唯一路径的 path 的依赖
   * 在传入 `name` 值时必须保证其在路径上的唯一性
   * 一般不建议手动管理 `name`，采用默认值即可
   */
  get name() {
    if (!this.parent) {
      return `root_${this.id}`;
    }
    return this.getMetadata('name') || String(this.id);
  }

  set name(name: string) {
    this.addMetadata('name', name);
  }

  // 节点绝对路径
  get path(): string {
    if (!this.parent) {
      return new Path(`${Path.separator}${this.name}`).toString();
    }
    return new Path(this.parent.path).join(this.name).toString();
  }

  get accessibilityInformation(): IAccessibilityInformation {
    return {
      label: this.name,
      role: 'treeitem',
    };
  }

  public getMetadata(withKey: string): any {
    if (withKey === 'name' && !this._metadata[withKey]) {
      this._metadata[withKey] = String(TreeNode.nextId());
    }
    return this._metadata[withKey];
  }

  public addMetadata(withKey: string, value: any) {
    if (!(withKey in this._metadata)) {
      this._metadata[withKey] = value;
      this._watcher.notifyDidChangeMetadata(this, {
        type: MetadataChangeType.Added,
        key: withKey,
        prevValue: void 0,
        value,
      });
    } else {
      const prevValue = this._metadata[withKey];
      this._metadata[withKey] = value;
      this._watcher.notifyDidChangeMetadata(this, { type: MetadataChangeType.Updated, key: withKey, prevValue, value });
    }
  }

  public removeMetadata(withKey: string) {
    if (withKey in this._metadata) {
      const prevValue = this._metadata[withKey];
      delete this._metadata[withKey];
      this._watcher.notifyDidChangeMetadata(this, {
        type: MetadataChangeType.Removed,
        key: withKey,
        prevValue,
        value: void 0,
      });
    }
  }

  /**
   * 这里的move操作可能为移动，也可能为重命名
   *
   * @param {ICompositeTreeNode} to
   * @param {string} [name=this.name]
   * @returns
   * @memberof TreeNode
   */
  public mv(to: ICompositeTreeNode | null, name: string = this.name) {
    // 一个普通节点必含有父节点，根节点不允许任何操作
    const prevParent = this._parent as CompositeTreeNode;
    if (to === null || !CompositeTreeNode.is(to)) {
      this._parent = undefined;
      this.dispose();
      return;
    }
    const didChangeParent = prevParent !== to;
    const prevPath = this.path;

    this._depth = to.depth + 1;

    if (didChangeParent || name !== this.name) {
      this.addMetadata('name', name);
      if (didChangeParent) {
        this._watcher.notifyWillChangeParent(this, prevParent, to);
      }
      if (this.parent) {
        (this.parent as CompositeTreeNode).unlinkItem(this, true);
        this._parent = to;
        (this.parent as CompositeTreeNode).insertItem(this);
      }
      if (didChangeParent) {
        this._watcher.notifyDidChangeParent(this, prevParent, to);
      }
    }

    if (this.path !== prevPath) {
      this._watcher.notifyDidChangePath(this);
    }
  }

  public get visible(): boolean {
    return this._visible;
  }

  public setVisible(b: boolean): this {
    this._visible = b;
    return this;
  }

  public dispose() {
    if (this._disposed) {
      return;
    }

    TreeNode.removeTreeNode(this.id, this.path);
    this._disposed = true;
    this._watcher.notifyDidDispose(this);
  }
}

export class CompositeTreeNode extends TreeNode implements ICompositeTreeNode {
  private static defaultSortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode): number {
    if (a.constructor === b.constructor) {
      return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
    }
    return CompositeTreeNode.is(a) ? -1 : CompositeTreeNode.is(b) ? 1 : 0;
  }

  public static is(node: any): node is ICompositeTreeNode {
    return !!node && 'children' in node;
  }

  public static isRoot(node: any): boolean {
    return CompositeTreeNode.is(node) && !node.parent;
  }

  private static REFRESH_DELAY = 200;

  protected _children: ITreeNodeOrCompositeTreeNode[] | null = null;
  // 节点的分支数量
  private _branchSize: number;
  private _flattenedBranch: number[] | null;

  private _lock = false;
  private _root: ICompositeTreeNode | null;

  private watchTerminator: (path: string) => void;

  public watchEvents: Map<string, IWatcherInfo>;
  public isExpanded: boolean;

  private refreshThrottler: ThrottledDelayer<void> = new ThrottledDelayer(CompositeTreeNode.REFRESH_DELAY);
  private toRefreshPathQueue = new Set<string>();

  protected generatorWatcher() {
    const emitter = new Emitter<any>();
    const onEventChanges: Event<any> = emitter.event;
    const disposeCollection = new DisposableCollection();
    const terminateWatch = (path: string) => {
      this.watchEvents.delete(path);
    };
    const watcher: ITreeWatcher = {
      notifyWillProcessWatchEvent: (target: ICompositeTreeNode, event: IWatcherEvent) => {
        emitter.fire({ type: TreeNodeEvent.WillProcessWatchEvent, args: [target, event] });
      },
      notifyWillChangeParent: (
        target: ITreeNodeOrCompositeTreeNode,
        prevParent: ICompositeTreeNode,
        newParent: ICompositeTreeNode,
      ) => {
        emitter.fire({ type: TreeNodeEvent.WillChangeParent, args: [target, prevParent, newParent] });
      },
      notifyDidChangeParent: (
        target: ITreeNodeOrCompositeTreeNode,
        prevParent: ICompositeTreeNode,
        newParent: ICompositeTreeNode,
      ) => {
        emitter.fire({ type: TreeNodeEvent.DidChangeParent, args: [target, prevParent, newParent] });
      },
      notifyDidDispose: (target: ITreeNodeOrCompositeTreeNode) => {
        emitter.fire({ type: TreeNodeEvent.DidDispose, args: [target] });
      },
      notifyDidProcessWatchEvent: (target: ICompositeTreeNode, event: IWatcherEvent) => {
        emitter.fire({ type: TreeNodeEvent.DidProcessWatchEvent, args: [target, event] });
      },
      notifyDidChangePath: (target: ITreeNodeOrCompositeTreeNode) => {
        emitter.fire({ type: TreeNodeEvent.DidChangePath, args: [target] });
      },
      notifyWillChangeExpansionState: (target: ICompositeTreeNode, nowExpanded: boolean) => {
        const isVisible = this.isItemVisibleAtSurface(target);
        emitter.fire({ type: TreeNodeEvent.WillChangeExpansionState, args: [target, nowExpanded, isVisible] });
      },
      notifyDidChangeExpansionState: (target: ICompositeTreeNode, nowExpanded: boolean) => {
        const isVisible = this.isItemVisibleAtSurface(target);
        emitter.fire({ type: TreeNodeEvent.DidChangeExpansionState, args: [target, nowExpanded, isVisible] });
      },
      notifyDidChangeMetadata: (target: ITreeNode | ICompositeTreeNode, change: IMetadataChange) => {
        emitter.fire({ type: TreeNodeEvent.DidChangeMetadata, args: [target, change] });
      },
      notifyDidUpdateBranch: () => {
        emitter.fire({ type: TreeNodeEvent.BranchDidUpdate, args: [] });
      },
      notifyWillResolveChildren: (target: ICompositeTreeNode, nowExpanded: boolean) => {
        emitter.fire({ type: TreeNodeEvent.WillResolveChildren, args: [target, nowExpanded] });
      },
      notifyDidResolveChildren: (target: ICompositeTreeNode, nowExpanded: boolean) => {
        emitter.fire({ type: TreeNodeEvent.DidResolveChildren, args: [target, nowExpanded] });
      },
      // 监听所有事件
      on: (event: TreeNodeEvent, callback: any) => {
        const dispose = onEventChanges((data) => {
          if (data.type === event) {
            callback(...data.args);
          }
        });
        disposeCollection.push(dispose);
        return dispose;
      },
      // 监听Watch事件变化
      onWatchEvent: (path: string, callback: IWatcherCallback): IWatchTerminator => {
        const terminator: IWatchTerminator = terminateWatch;
        this.watchEvents.set(path, { terminator, callback });
        return terminator;
      },
      dispose: disposeCollection,
    };
    return watcher;
  }

  // parent 为undefined即表示该节点为根节点
  constructor(
    tree: ITree,
    parent?: ICompositeTreeNode,
    watcher?: ITreeWatcher,
    optionalMetadata?: { [key: string]: any },
  ) {
    super(tree, parent, watcher, optionalMetadata);
    this.isExpanded = parent ? false : true;
    this._branchSize = 0;
    if (!parent) {
      this.watchEvents = new Map();
      // 为根节点创建监听器
      this._watcher = this.generatorWatcher();
      this._root = this;
      TreeNode.setTreeNode(this.id, this.path, this);
    } else {
      this._watcher = (parent as any).watcher;
    }
  }

  // 重载 name 的 getter/setter，路径改变时需要重新监听文件节点变化
  set name(name: string) {
    const prevPath = this.path;
    if (!CompositeTreeNode.isRoot(this) && typeof this.watchTerminator === 'function') {
      this.watchTerminator(prevPath);
      this.addMetadata('name', name);
      this.watchTerminator = this.watcher.onWatchEvent(this.path, this.handleWatchEvent);
    } else {
      this.addMetadata('name', name);
    }
  }

  get name() {
    // 根节点保证路径不重复
    if (!this.parent) {
      return `root_${this.id}`;
    }
    return this.getMetadata('name');
  }

  // 作为根节点唯一的watcher需要在生成新节点的时候传入
  get watcher() {
    return this._watcher;
  }

  get type() {
    return TreeNodeType.CompositeTreeNode;
  }

  get children() {
    return this._children;
  }

  get expanded() {
    return this.isExpanded;
  }

  /**
   * 当前可见的分支数量
   *
   * 当节点为展开状态时，其整个分支（递归展平）由上一级的分支（根（位于数据层可见）或处于折叠状态的分支）拥有
   * 当节点为折叠状态时，其整个分支（递归展平）由其上一级父目录展开该节点
   *
   * @readonly
   * @memberof CompositeTreeNode
   */
  get branchSize() {
    return this._branchSize;
  }

  /**
   * 获取当前节点的分支数，一般为顶层节点，如Root上获取
   *
   * @readonly
   * @memberof CompositeTreeNode
   */
  get flattenedBranch() {
    return this._flattenedBranch;
  }

  get lock() {
    return this._lock;
  }

  get root() {
    if (isUndefined(this._root)) {
      this._root = this.getRoot() || null;
    }
    return this._root;
  }

  private getRoot() {
    let root = this.parent;
    while (root && root.parent) {
      root = root.parent;
    }
    return root;
  }

  /**
   * 确保此“目录”的子级已加载（不影响“展开”状态）
   * 如果子级已经加载，则返回的Promise将立即解决
   * 否则，将发出重新加载请求并返回Promise
   * 一旦返回的Promise.resolve，“CompositeTreeNode＃children” 便可以访问到对于节点
   */
  public async ensureLoaded(token?: CancellationToken) {
    if (this._children) {
      return;
    }
    return await this.hardReloadChildren(token);
  }

  // 展开节点
  public async setExpanded(ensureVisible = true, quiet = false, isOwner = true, token?: CancellationToken) {
    if (this.disposed) {
      return;
    }
    // 根节点不可折叠
    if (CompositeTreeNode.isRoot(this)) {
      return;
    }
    if (this.isExpanded) {
      return;
    }
    if (isOwner) {
      const state = TreeNode.getGlobalTreeState(this.path);
      state.loadPathCancelToken.cancel();
      state.refreshCancelToken.cancel();
      TreeNode.setGlobalTreeState(this.path, {
        isExpanding: true,
      });
    }
    this.isExpanded = true;
    if (this._children === null) {
      this._watcher.notifyWillResolveChildren(this, this.isExpanded);
      await this.hardReloadChildren(token);
      this._watcher.notifyDidResolveChildren(this, this.isExpanded);
      // 检查其是否展开；可能同时执行了 setCollapsed 方法
      if (!this.isExpanded || token?.isCancellationRequested) {
        if (isOwner) {
          TreeNode.setGlobalTreeState(this.path, {
            isExpanding: false,
          });
        }
        return;
      }
    }

    if (ensureVisible && this.parent && CompositeTreeNode.is(this.parent)) {
      /**
       * 在传入 ensureVisible = true 时，这里传入的 token 不能取消所有副作用
       * 故在使用 ensureVisible = true 时必须保证 `setExpanded` 与 `setCollapsed` 的独立性
       * 如需要 `await node.setExpanded(true)` 后再执行 `node.setCollapsed()`
       */
      await (this.parent as CompositeTreeNode).setExpanded(true, !quiet, false, token);
    }

    if (token?.isCancellationRequested) {
      if (isOwner) {
        TreeNode.setGlobalTreeState(this.path, {
          isExpanding: false,
        });
      }
      return;
    }

    if (this.isExpanded) {
      this._watcher.notifyWillChangeExpansionState(this, true);
      // 与根节点合并分支
      this.expandBranch(this, quiet);
      this._watcher.notifyDidChangeExpansionState(this, true);
    }
    if (isOwner) {
      TreeNode.setGlobalTreeState(this.path, {
        isExpanding: false,
      });
      TreeNode.setTreeNode(this.id, this.path, this);
    }
  }

  // 获取当前节点下所有展开的节点路径
  private getAllExpandedNodePath() {
    const paths: string[] = [];
    let start = 0;
    if (!CompositeTreeNode.isRoot(this)) {
      // 找到节点位置下标，向下进一步查找展开目录
      start = (this.root as CompositeTreeNode)?.getIndexAtTreeNodeId(this.id) + 1;
    }
    const end = start + this.branchSize;
    for (let i = start; i < end; i++) {
      const node = (this.root as CompositeTreeNode)?.getTreeNodeAtIndex(i);
      if (CompositeTreeNode.is(node) && (node as CompositeTreeNode).expanded) {
        paths.push(node.path);
      }
    }
    return paths;
  }

  // 获取当前节点下所有折叠的节点路径
  private getAllCollapsedNodePath() {
    let paths: string[] = [];
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (!CompositeTreeNode.is(child)) {
          continue;
        }
        if ((child as CompositeTreeNode).isExpanded) {
          paths = paths.concat((child as CompositeTreeNode).getAllCollapsedNodePath());
        } else {
          paths.push(child.path);
        }
      }
      return paths;
    } else {
      return paths;
    }
  }

  /**
   * 处理节点数据，让节点重新加载子节点及初始化 flattenedBranch
   * @param token CancellationToken
   */
  private async resolveChildrens(token?: CancellationToken) {
    let childrens = this.children;
    let expandedPaths: string[] = [];
    try {
      childrens = (await this._tree.resolveChildren(this)) || [];
    } catch (e) {
      childrens = [];
    }

    if (token?.isCancellationRequested) {
      return false;
    }

    const flatTree = new Array(childrens.length);
    this._children = Array(childrens.length);
    for (let i = 0; i < childrens.length; i++) {
      const child = childrens[i];
      // 如果存在上一次缓存的节点，则使用缓存节点的 ID
      (child as TreeNode).id = TreeNode.getIdByPath(child.path) || (child as TreeNode).id;
      this._children[i] = child;
      TreeNode.setIdByPath(child.path, child.id);
    }

    this._children?.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);

    for (let i = 0; i < childrens.length; i++) {
      flatTree[i] = this._children[i].id;
    }
    const expandedChilds: CompositeTreeNode[] = [];
    for (let i = 0, len = this.children?.length || 0; i < len; i++) {
      const subChild = this.children?.[i];
      if (CompositeTreeNode.is(subChild) && subChild.expanded) {
        const paths = await (subChild as CompositeTreeNode).resolveChildrens(token);
        if (paths) {
          expandedPaths = expandedPaths.concat(paths);
        }
        if (token?.isCancellationRequested) {
          return;
        }
        expandedChilds.push(subChild as CompositeTreeNode);
      }
    }
    this._branchSize = flatTree.length;
    this.setFlattenedBranch(flatTree);
    for (let i = 0; i < expandedChilds.length; i++) {
      const child = expandedChilds[i];
      child.expandBranch(child, true);
    }
    return expandedPaths.concat(expandedChilds.map((child) => child.path.toString()));
  }

  private updateTreeNodeCache(child: CompositeTreeNode | TreeNode) {
    TreeNode.setTreeNode(child.id, child.path, child);
    if (CompositeTreeNode.is(child) && child.expanded && child.children?.length) {
      for (let i = 0; i < child.children.length; i++) {
        const subChild = child.children[i];
        this.updateTreeNodeCache(subChild as TreeNode | CompositeTreeNode);
      }
    }
  }

  /**
   * 静默刷新子节点, 即不触发分支更新事件
   * @param toExpandPaths 待展开的路径
   * @param token CancellationToken
   * @param origin 当 this === origin 时，说明此节点为调用的源头节点
   */
  private async refreshTreeNodeByPaths(
    toExpandPaths: string[] = this.getAllExpandedNodePath(),
    token?: CancellationToken,
    origin?: CompositeTreeNode,
  ): Promise<string[] | void> {
    if (!CompositeTreeNode.is(this)) {
      return;
    }
    // 如果某次刷新操作被取消，则下次刷新依旧使用上一次刷新的展开目录进行刷新
    let toExpandPath;
    const originChildren = this.children;
    let childrens = this.children || [];
    if (this.expanded) {
      if (this === origin) {
        try {
          childrens = (await this._tree.resolveChildren(this)) || [];
        } catch (e) {
          childrens = [];
        }

        if (token?.isCancellationRequested) {
          return;
        }
        if (!this.expanded) {
          // 当请求刷新节点时，如果该节点已经不应该被处理，则清理 Children
          // 下次再被展开时便会自动更新 Children 最新内容
          if (this.children) {
            // 清理子节点，等待下次展开时更新
            if (!!this.children && this.parent) {
              for (let i = 0; i < this.children.length; i++) {
                const child = this.children[i];
                (child as CompositeTreeNode).dispose();
              }
              this._children = null;
            }
          }
          return;
        }
      }
      while ((toExpandPath = toExpandPaths.shift())) {
        const isRelative = toExpandPath.indexOf(`${this.path}${Path.separator}`) > -1;
        if (!isRelative) {
          if (toExpandPath === this.path) {
            toExpandPath = undefined;
          }
          break;
        }
        const child = childrens?.find((child) => child.path === toExpandPath);
        // 对于压缩情况的路径需要额外处理一下
        // 如果这里加载的路径是 a/b/c, 有可能目前只加载到 a/b
        if (!child) {
          if (!childrens || childrens.length === 0) {
            break;
          }
          for (let i = 0; i < childrens.length; i++) {
            const child = childrens[i];
            const isInclude = toExpandPath.indexOf(`${child.path}${Path.separator}`) === 0; // 展开路径包含子节点路径
            if (isInclude && CompositeTreeNode.is(child)) {
              // 包含压缩节点的情况
              if (!CompositeTreeNode.is(child)) {
                // 说明此节点为非折叠节点时不处理
                continue;
              }
              if ((child as CompositeTreeNode).isExpanded) {
                // 说明该展开路径对应的节点确实已不存在
                continue;
              }
              (child as CompositeTreeNode).isExpanded = true;
              // 加载路径包含当前判断路径，尝试加载该节点再匹配
              const extraExpandedPaths = await (child as CompositeTreeNode).resolveChildrens(token);
              if (token?.isCancellationRequested) {
                return;
              }
              if (extraExpandedPaths) {
                toExpandPaths = toExpandPaths.filter((path) => !extraExpandedPaths.find((a) => a === path));
              }
              if (child.path !== toExpandPath && !toExpandPaths.includes(child.path)) {
                toExpandPaths.unshift(toExpandPath);
              }
              if (toExpandPaths.length > 0) {
                // 不需要重新加载压缩节点的子节点内容
                toExpandPaths =
                  (await (child as CompositeTreeNode).refreshTreeNodeByPaths([...toExpandPaths], token, origin)) || [];
                if (token?.isCancellationRequested) {
                  return;
                }
              }
              break;
            }
          }
        } else if (CompositeTreeNode.is(child)) {
          // 如果节点默认展开，则忽略后续操作
          if (!(child as CompositeTreeNode).expanded) {
            (child as CompositeTreeNode).isExpanded = true;
            const extraExpandedPaths = await (child as CompositeTreeNode).resolveChildrens(token);
            if (token?.isCancellationRequested) {
              return;
            }
            if (extraExpandedPaths) {
              toExpandPaths = toExpandPaths.filter((path) => !extraExpandedPaths.find((a) => a.includes(path)));
            }
            if (toExpandPaths.length > 0 && !token?.isCancellationRequested) {
              toExpandPaths =
                (await (child as CompositeTreeNode).refreshTreeNodeByPaths([...toExpandPaths], token, origin)) || [];
              if (token?.isCancellationRequested) {
                return;
              }
            }
          }
        }
      }

      if (toExpandPath) {
        // 仍然存在需要进一步处理的待展开路径
        toExpandPaths.unshift(toExpandPath);
        if (this === origin) {
          // 说明待展开的路径已经不存在，直接处理子节点
          if (originChildren) {
            this.shrinkBranch(this, true);

            for (let i = 0; i < originChildren.length; i++) {
              const child = originChildren[i];
              child?.dispose();
            }
          }
          const expandedChilds: CompositeTreeNode[] = [];

          const flatTree = new Array(childrens.length);
          this._children = Array(childrens.length);
          for (let i = 0; i < childrens.length; i++) {
            const child = childrens[i];
            // 如果存在上一次缓存的节点，则使用缓存节点的 ID
            (child as TreeNode).id = TreeNode.getIdByPath(child.path) || (child as TreeNode).id;
            this._children[i] = child;
            TreeNode.setIdByPath(child.path, child.id);
            if (CompositeTreeNode.is(child) && child.expanded) {
              expandedChilds.push(child as CompositeTreeNode);
            }
          }
          this._children.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);
          for (let i = 0; i < childrens.length; i++) {
            flatTree[i] = this._children[i].id;
          }

          this._branchSize = flatTree.length;
          this.setFlattenedBranch(flatTree, true);
          this.watcher.notifyDidUpdateBranch();
        }
        if (this.parent !== origin) {
          // 将所有子节点合并至第二层 Children 上，减少后续递归拼接带来额外成本
          this.expandBranch(this, true);
        }
        return toExpandPaths;
      } else if (CompositeTreeNode.isRoot(this)) {
        if (this.children) {
          this.shrinkBranch(this, true);
          for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            child?.dispose();
          }
        }
        const expandedChilds: CompositeTreeNode[] = [];
        const otherChilds: CompositeTreeNode[] = [];

        const flatTree = new Array(childrens.length);
        this._children = Array(childrens.length);
        for (let i = 0; i < childrens.length; i++) {
          const child = childrens[i];
          // 如果存在上一次缓存的节点，则使用缓存节点的 ID
          (child as TreeNode).id = TreeNode.getIdByPath(child.path) || (child as TreeNode).id;
          this._children[i] = child;
          TreeNode.setIdByPath(child.path, child.id);
          if (CompositeTreeNode.is(child) && child.expanded) {
            if (!child.children) {
              await (child as CompositeTreeNode).resolveChildrens(token);
              if (token?.isCancellationRequested) {
                return;
              }
            }
            expandedChilds.push(child as CompositeTreeNode);
          } else {
            otherChilds.push(child as CompositeTreeNode);
          }
        }

        this._children.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);

        for (let i = 0; i < childrens.length; i++) {
          flatTree[i] = this._children[i].id;
        }

        this._branchSize = flatTree.length;
        this.setFlattenedBranch(flatTree, true);
        for (let i = 0; i < expandedChilds.length; i++) {
          const child = expandedChilds[i];
          child.expandBranch(child, true);
          this.updateTreeNodeCache(child);
        }
        for (let i = 0; i < otherChilds.length; i++) {
          const child = otherChilds[i];
          this.updateTreeNodeCache(child);
        }
        // 清理上一次监听函数
        if (typeof this.watchTerminator === 'function') {
          this.watchTerminator(this.path);
        }
        this.watchTerminator = this.watcher.onWatchEvent(this.path, this.handleWatchEvent);
        this.watcher.notifyDidUpdateBranch();
      } else {
        // 非根节点刷新的情况
        const expandedChilds: CompositeTreeNode[] = [];

        if (this === origin) {
          // 通知节点更新
          if (this.children) {
            // 重置旧的节点分支
            this.shrinkBranch(this, true);
          }
          if (this.children) {
            for (let i = 0, len = this.children.length; i < len; i++) {
              const child = this.children[i];
              (child as TreeNode).dispose();
            }
          }
          const flatTree = new Array(childrens.length);
          this._children = Array(childrens.length);

          for (let i = 0, len = childrens.length; i < len; i++) {
            const child = childrens[i];
            (child as TreeNode).id = TreeNode.getIdByPath(child.path) || (child as TreeNode).id;
            this._children[i] = child;
            TreeNode.setIdByPath(child.path, child.id);
            if (CompositeTreeNode.is(child) && (child as CompositeTreeNode).expanded) {
              expandedChilds.push(child as CompositeTreeNode);
            }
            this.updateTreeNodeCache(child as TreeNode | CompositeTreeNode);
          }

          this._children.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);

          for (let i = 0; i < childrens.length; i++) {
            flatTree[i] = this._children[i].id;
          }

          this._branchSize = flatTree.length;
          this.setFlattenedBranch(flatTree);
          for (let i = 0; i < expandedChilds.length; i++) {
            const child = expandedChilds[i];
            child.expandBranch(child, true);
          }
        } else {
          for (let i = 0; i < childrens.length; i++) {
            const child = childrens[i];
            if ((child as CompositeTreeNode).expanded) {
              expandedChilds.push(child as CompositeTreeNode);
            }
          }
        }
        for (let i = 0; i < expandedChilds.length; i++) {
          const child = expandedChilds[i];
          child.expandBranch(child, true);
        }
        if (typeof this.watchTerminator === 'function') {
          this.watchTerminator(this.path);
        }
        this.watchTerminator = this.watcher.onWatchEvent(this.path, this.handleWatchEvent);
        if (this === origin) {
          this.expandBranch(this);
        }
      }
    } else {
      // 仅需处理存在子节点的情况，否则将会影响刷新后的节点长度
      if (this.children) {
        // 清理子节点，等待下次展开时更新
        if (!!this.children && this.parent) {
          // eslint-disable-next-line @typescript-eslint/prefer-for-of
          for (let i = 0, len = this.children.length; i < len; i++) {
            const child = this.children[i];
            (child as CompositeTreeNode).dispose();
          }
          this._children = null;
        }
      }
      return;
    }
  }

  public async expandedAll(collapsedPaths: string[] = this.getAllCollapsedNodePath()) {
    // 仅根节点使用
    if (!CompositeTreeNode.isRoot(this)) {
      return;
    }
    collapsedPaths = collapsedPaths.sort((a, b) => Path.pathDepth(a) - Path.pathDepth(b));
    let path;
    while (collapsedPaths.length > 0) {
      path = collapsedPaths.pop();
      const item = TreeNode.getTreeNodeByPath(path);
      if (CompositeTreeNode.is(item)) {
        await (item as CompositeTreeNode).setExpanded(false, true);
      }
    }
    // 通知分支树已更新
    this.watcher.notifyDidUpdateBranch();
  }

  public async collapsedAll(expandedPaths: string[] = this.getAllExpandedNodePath()) {
    // 仅根节点使用
    if (!CompositeTreeNode.isRoot(this)) {
      return;
    }
    expandedPaths = expandedPaths.sort((a, b) => Path.pathDepth(a) - Path.pathDepth(b));
    let path;
    while (expandedPaths.length > 0) {
      path = expandedPaths.pop();
      const item = TreeNode.getTreeNodeByPath(path);
      if (CompositeTreeNode.is(item)) {
        (item as CompositeTreeNode).setCollapsed(true);
      }
    }
    // 通知分支树已更新
    this.watcher.notifyDidUpdateBranch();
  }

  // 折叠节点
  public setCollapsed(quiet = false) {
    // 根节点不可折叠
    if (CompositeTreeNode.isRoot(this) || this.disposed) {
      return;
    }
    if (!this.isExpanded) {
      return;
    }
    const state = TreeNode.getGlobalTreeState(this.path);
    if (state.isExpanding) {
      // 当节点处于加载子节点过程时，尽管为展开状态，但此时不应该支持折叠节点
      return;
    }
    state.loadPathCancelToken.cancel();
    state.refreshCancelToken.cancel();
    this._watcher.notifyWillChangeExpansionState(this, false);
    if (this._children && this.parent) {
      // 从根节点裁剪分支
      this.shrinkBranch(this, quiet);
    }
    this.isExpanded = false;
    TreeNode.setTreeNode(this.id, this.path, this);
    this._watcher.notifyDidChangeExpansionState(this, false);
  }

  public mv(to: ICompositeTreeNode, name: string = this.name) {
    const prevPath = this.path;
    super.mv(to, name);
    if (typeof this.watchTerminator === 'function') {
      this.watchTerminator(prevPath);
      this.watchTerminator = this.watcher.onWatchEvent(this.path, this.handleWatchEvent);
    }
    // 同时移动过子节点
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        child.mv(child.parent as ICompositeTreeNode, child.name);
      }
    }
  }

  /**
   * 在节点中插入新的节点
   *
   * 直接调用此方法将不会触发onWillHandleWatchEvent和onDidHandleWatchEvent事件
   */
  public insertItem(item: ITreeNodeOrCompositeTreeNode) {
    if (item.parent !== this) {
      item.mv(this, item.name);
      return;
    }
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        // path / id 是节点唯一标识
        if (this.children[i].path === item.path) {
          this.children[i] = item;
          return;
        }
      }
    }
    const branchSizeIncrease = 1 + (item instanceof CompositeTreeNode && item.expanded ? item._branchSize : 0);
    if (this._children) {
      this._children.push(item);
      this._children.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);
    }
    this._branchSize += branchSizeIncrease;
    let master = this as CompositeTreeNode;
    // 如果该节点无叶子节点，则继续往上查找合适的插入位置
    while (!master._flattenedBranch) {
      if (master.parent) {
        master = master.parent as CompositeTreeNode;
        master._branchSize += branchSizeIncrease;
      }
    }
    if (!this._children) {
      return;
    }
    let relativeInsertionIndex = this._children.indexOf(item);
    let absInsertionIndex;
    const leadingSibling = this._children[relativeInsertionIndex - 1];
    if (leadingSibling) {
      const siblingIdx = master._flattenedBranch.indexOf(leadingSibling.id);
      relativeInsertionIndex =
        siblingIdx +
        (leadingSibling instanceof CompositeTreeNode && leadingSibling.expanded ? leadingSibling._branchSize : 0);
    } else {
      relativeInsertionIndex = master._flattenedBranch.indexOf(this.id);
    }
    if (relativeInsertionIndex === -1) {
      if (this._branchSize === 1) {
        // 在空Tree中插入节点时，相对插入位置为0
        relativeInsertionIndex = 0;
      }
    }
    // 非空Tree情况下需要+1，为了容纳自身节点位置，在插入节点下方插入新增节点
    absInsertionIndex = relativeInsertionIndex + 1;
    // 空 Tree 情况下需要重置为 0，避免设置 Uint32Array 时超出范围
    if (master._flattenedBranch.length === 0) {
      absInsertionIndex = 0;
    }
    let branch: number[] = [item.id];
    if (item instanceof CompositeTreeNode && item.expanded && item._flattenedBranch) {
      branch = branch.concat(item._flattenedBranch);
      (item as CompositeTreeNode).setFlattenedBranch(null);
    }
    master.setFlattenedBranch(spliceArray(master._flattenedBranch, absInsertionIndex, 0, branch));
    TreeNode.setTreeNode(item.id, item.path, item as TreeNode);
    return item;
  }

  /**
   * 从父节点中移除节点
   *
   * 直接调用此方法将不会触发onWillHandleWatchEvent和onDidHandleWatchEvent事件
   */
  public unlinkItem(item: ITreeNodeOrCompositeTreeNode, reparenting?: boolean): void {
    if (!this._children) {
      return;
    }
    const idx = this._children.indexOf(item);
    if (idx === -1) {
      return;
    }
    // 当删除时父节点已不存在界面上时，跳过插入操作
    if (!this.isItemVisibleAtRootSurface(this)) {
      return;
    }
    this._children?.splice(idx, 1);
    const branchSizeDecrease = 1 + (item instanceof CompositeTreeNode && item.expanded ? item._branchSize : 0);
    this._branchSize -= branchSizeDecrease;
    // 逐级往上查找节点的父节点，并沿途裁剪分支数
    let master = this as CompositeTreeNode;
    while (!master._flattenedBranch) {
      if (master.parent) {
        master = master.parent as CompositeTreeNode;
        master._branchSize -= branchSizeDecrease;
      }
    }
    const removalBeginIdx = master._flattenedBranch.indexOf(item.id);
    if (removalBeginIdx === -1) {
      return;
    }

    if (item instanceof CompositeTreeNode && item.expanded) {
      (item as CompositeTreeNode).setFlattenedBranch(
        master._flattenedBranch.slice(removalBeginIdx + 1, removalBeginIdx + branchSizeDecrease),
      );
    }

    master.setFlattenedBranch(spliceArray(master._flattenedBranch, removalBeginIdx, branchSizeDecrease));

    if (!reparenting && item.parent === this) {
      item.mv(null);
    }
  }

  /**
   * 转换节点路径
   */
  private transferItem(oldPath: string, newPath: string) {
    const oldP = new Path(oldPath);
    const from = oldP.dir.toString();
    if (from !== this.path) {
      return;
    }
    const name = oldP.base.toString();
    const item = this._children?.find((c) => c.name === name);
    if (!item) {
      return;
    }
    const newP = new Path(newPath);
    const to = newP.dir.toString();
    const destDir = to === from ? this : TreeNode.getTreeNodeByPath(to);
    if (!CompositeTreeNode.is(destDir)) {
      this.unlinkItem(item);
      return;
    }
    item.mv(destDir, newP.base.toString());
    return item;
  }

  public dispose() {
    // 如果存在对应文件路径下的监听，同样需要清理掉
    if (this.watchEvents) {
      const watcher = this.watchEvents.get(this.path);
      if (watcher) {
        watcher.terminator();
      }
      this.watchEvents.clear();
    }
    if (this._children) {
      // 移除后应该折叠，因为下次初始化默认值为折叠，否则将会导致下次插入异常
      this.isExpanded = false;
      this._children.forEach((child) => {
        (child as CompositeTreeNode).dispose();
      });
      this._children = null;
      this._flattenedBranch = null;
    }
    super.dispose();
  }

  /**
   * 设置扁平化的分支信息
   */
  protected setFlattenedBranch(leaves: number[] | null, withoutNotify?: boolean) {
    this._flattenedBranch = leaves;
    // Root节点才通知更新
    if (CompositeTreeNode.isRoot(this) && !withoutNotify) {
      this.watcher.notifyDidUpdateBranch();
    }
  }

  /**
   * 展开分支节点
   * @param branch 分支节点
   */
  protected expandBranch(branch: CompositeTreeNode, withoutNotify?: boolean) {
    if (this !== branch) {
      // 但节点为展开状态时进行裁剪
      if (branch._flattenedBranch) {
        this._branchSize += branch._branchSize;
      }
    }
    // 当前节点为折叠状态，更新分支信息
    if (this !== branch && this._flattenedBranch) {
      const injectionStartIdx = this._flattenedBranch.indexOf(branch.id) + 1;
      if (injectionStartIdx === 0) {
        // 中途发生了branch更新事件，此时的_flattenedBranch可能已被更新，即查找不到branch.id
        // 这种情况在父节点发生了多路径目录的创建定位动作下更易复现
        // 例：文件树在执行a/b/c定位操作时需要请求三次数据，而更新操作可能只需要一次
        // 导致就算更新操作后置执行，也可能比定位操作先执行完，同时将_flattenedBranch更新
        // 最终导致此处查询不到对应节点，下面的shrinkBranch同样可能有相同问题，如点击折叠全部功能时
        return;
      }
      this.setFlattenedBranch(
        spliceArray(this._flattenedBranch, injectionStartIdx, 0, branch._flattenedBranch),
        withoutNotify,
      );
      // 取消展开分支对于分支的所有权，即最终只会有顶部Root拥有所有分支信息
      branch.setFlattenedBranch(null, withoutNotify);
    } else if (this.parent) {
      (this.parent as CompositeTreeNode).expandBranch(branch, withoutNotify);
    }
  }

  /**
   * 清理分支节点
   * @param branch 分支节点
   */
  protected shrinkBranch(branch: CompositeTreeNode, withoutNotify?: boolean) {
    if (this !== branch) {
      // 这里的`this`实际上为父节点
      // `this`的分支大小没有改变，仍然具有相同数量的叶子，但是从父级参照系（即根节点）来看，其分支缩小了
      this._branchSize -= branch._branchSize;
    }
    if (this !== branch && this._flattenedBranch) {
      const removalStartIdx = this._flattenedBranch.indexOf(branch.id) + 1;
      if (removalStartIdx === 0) {
        // 中途发生了branch更新事件，此时的_flattenedBranch可能已被更新，即查找不到branch.id
        return;
      }
      // 返回分支对于分支信息所有权，即将折叠的节点信息再次存储于折叠了的节点中
      branch.setFlattenedBranch(
        this._flattenedBranch.slice(removalStartIdx, removalStartIdx + branch._branchSize),
        withoutNotify,
      );
      this.setFlattenedBranch(
        spliceArray(
          this._flattenedBranch,
          removalStartIdx,
          branch._flattenedBranch ? branch._flattenedBranch.length : 0,
        ),
        withoutNotify,
      );
    } else if (this.parent) {
      (this.parent as CompositeTreeNode).shrinkBranch(branch, withoutNotify);
    }
  }

  /**
   * 加载子节点信息
   * 当返回值为 true 时，正常加载完子节点并同步到数据结构中
   * 返回值为 false 时，加载节点的过程被中断
   *
   * @memberof CompositeTreeNode
   */
  public async hardReloadChildren(token?: CancellationToken) {
    let rawItems;

    const oldPath = this.path;

    try {
      // ! `this.path` maybe changed after `resolveChildren` in file tree compact mode
      rawItems = (await this._tree.resolveChildren(this)) || [];
    } catch (e) {
      rawItems = [];
    }
    // 当获取到新的子节点时，如果当前节点正处于非展开状态时，忽略后续裁切逻辑
    // 后续的 expandBranch 也不应该被响应
    if (!this.expanded || token?.isCancellationRequested) {
      return false;
    }
    if (this.path !== oldPath) {
      // do some clean up
      TreeNode.setGlobalTreeState(oldPath, {
        isExpanding: false,
        isLoadingPath: false,
        isRefreshing: false,
      });
    }

    const expandedChilds: CompositeTreeNode[] = [];
    const flatTree = new Array(rawItems.length);
    const tempChildren = new Array(rawItems.length);
    for (let i = 0; i < rawItems.length; i++) {
      const child = rawItems[i];
      (child as TreeNode).id = TreeNode.getIdByPath(child.path) || (child as TreeNode).id;
      tempChildren[i] = child;
      TreeNode.setIdByPath(child.path, child.id);
      if (CompositeTreeNode.is(child) && child.expanded) {
        if (!(child as CompositeTreeNode).children) {
          await (child as CompositeTreeNode).resolveChildrens(token);
        }
        if (token?.isCancellationRequested) {
          return false;
        }
        expandedChilds.push(child as CompositeTreeNode);
      }
    }

    tempChildren.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);

    for (let i = 0; i < rawItems.length; i++) {
      flatTree[i] = tempChildren[i].id;
    }

    if (this.children) {
      this.shrinkBranch(this);
    }
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        // The Child maybe `undefined`.
        child?.dispose();
      }
    }

    for (let i = 0; i < tempChildren.length; i++) {
      this.updateTreeNodeCache(tempChildren[i]);
    }

    this._children = tempChildren;
    this._branchSize = flatTree.length;
    this.setFlattenedBranch(flatTree);

    for (let i = 0; i < expandedChilds.length; i++) {
      const child = expandedChilds[i];
      (child as CompositeTreeNode).expandBranch(child, true);
    }

    // 清理上一次监听函数
    if (typeof this.watchTerminator === 'function') {
      this.watchTerminator(this.path);
    }
    this.watchTerminator = this.watcher.onWatchEvent(this.path, this.handleWatchEvent);
    return true;
  }

  public moveNode(oldPath: string, newPath: string) {
    if (typeof oldPath !== 'string') {
      throw new TypeError('Expected oldPath to be a string');
    }
    if (typeof newPath !== 'string') {
      throw new TypeError('Expected newPath to be a string');
    }
    if (Path.isRelative(oldPath)) {
      throw new TypeError('oldPath must be absolute');
    }
    if (Path.isRelative(newPath)) {
      throw new TypeError('newPath must be absolute');
    }
    return this.transferItem(oldPath, newPath);
  }

  public addNode(node: TreeNode) {
    if (!TreeNode.is(node)) {
      throw new TypeError('Expected node to be a TreeNode');
    }
    return this.insertItem(node);
  }

  public removeNode(path: string) {
    const pathObject = new Path(path);
    const dirName = pathObject.dir.toString();
    const name = pathObject.base.toString();
    if (dirName === this.path && !!this.children) {
      const item = this.children.find((c) => c.name === name);
      if (item) {
        this.unlinkItem(item);
      }
    }
  }

  /**
   * 处理 Watch 事件，同时可通过外部手动调 g用节点更新函数进行节点替换，这里为通用的事件管理
   * 如： transferItem，insertItem, unlinkItem等
   * @private
   * @memberof CompositeTreeNode
   */
  private handleWatchEvent = async (event: IWatcherEvent) => {
    this.watcher.notifyWillProcessWatchEvent(this, event);
    if (event.type === WatchEvent.Moved) {
      const { oldPath, newPath } = event;
      if (typeof oldPath !== 'string') {
        throw new TypeError('Expected oldPath to be a string');
      }
      if (typeof newPath !== 'string') {
        throw new TypeError('Expected newPath to be a string');
      }
      if (Path.isRelative(oldPath)) {
        throw new TypeError('oldPath must be absolute');
      }
      if (Path.isRelative(newPath)) {
        throw new TypeError('newPath must be absolute');
      }
      this.transferItem(oldPath, newPath);
    } else if (event.type === WatchEvent.Added) {
      const { node } = event;
      if (!TreeNode.is(node)) {
        throw new TypeError('Expected node to be a TreeNode');
      }
      this.insertItem(node);
    } else if (event.type === WatchEvent.Removed) {
      const { path } = event;
      const pathObject = new Path(path);
      const dirName = pathObject.dir.toString();
      const name = pathObject.base.toString();
      if (dirName === this.path && !!this.children) {
        const item = this.children.find((c) => c.name === name);
        if (item) {
          this.unlinkItem(item);
        }
      }
    } else {
      // 如果当前变化的节点已在数据视图（并非滚动到不可见区域）中不可见，则将该节点折叠，待下次更新即可，
      if (!this.isItemVisibleAtRootSurface(this)) {
        this.isExpanded = false;
        this._children = null;
      } else {
        await this.refresh();
      }
    }
    this.watcher.notifyDidProcessWatchEvent(this, event);
  };

  // 当没有传入具体路径时，使用当前展开目录作为刷新路径
  public async refresh(tokenSource?: CancellationTokenSource, target?: CompositeTreeNode) {
    if (!CompositeTreeNode.isRoot(this)) {
      // 刷新操作只能从根节点进行，便于对重复的刷新操作进行合并
      return await (this.root as CompositeTreeNode).refresh(tokenSource, this);
    }
    const state = TreeNode.getGlobalTreeState(this.path);
    if (state.isLoadingPath || state.isExpanding) {
      return;
    }
    let token;
    if (tokenSource && !tokenSource.token.isCancellationRequested) {
      TreeNode.setGlobalTreeState(this.path, {
        isRefreshing: true,
        refreshCancelToken: tokenSource,
      });
      token = tokenSource.token;
    } else {
      if (state.refreshCancelToken.token.isCancellationRequested) {
        const refreshCancelToken = new CancellationTokenSource();
        TreeNode.setGlobalTreeState(this.path, {
          isRefreshing: true,
          refreshCancelToken,
        });
        token = refreshCancelToken.token;
      } else {
        token = state.refreshCancelToken.token;
      }
    }
    this.toRefreshPathQueue.add((target || this).path);
    await this.refreshThrottler.trigger(() => this.doRefresh(token));
    TreeNode.setGlobalTreeState(this.path, {
      isRefreshing: false,
    });
  }

  private async doRefresh(token?: CancellationToken) {
    const target = (this.getRefreshNode() as CompositeTreeNode) || this;
    if (!CompositeTreeNode.is(target)) {
      return;
    }
    const paths = target.getAllExpandedNodePath();
    await target.refreshTreeNodeByPaths(paths, token, target);
  }

  private getRefreshNode() {
    let paths = Array.from(this.toRefreshPathQueue);
    this.toRefreshPathQueue.clear();
    if (!paths.length) {
      return this.root;
    }
    // 根据路径层级深度进行排序
    paths = paths.sort((a, b) => {
      const depthA = Path.pathDepth(a);
      const depthB = Path.pathDepth(b);
      return depthA - depthB;
    });
    if (paths.length === 1 || Path.pathDepth(paths[0]) === 1) {
      // 说明刷新队列中包含根节点，直接返回根节点进行刷新
      return TreeNode.getTreeNodeByPath(paths[0]);
    }
    const sortedPaths = paths.map((p) => new Path(p));
    let rootPath = sortedPaths[0];
    for (let i = 1, len = sortedPaths.length; i < len; i++) {
      if (rootPath.isEqualOrParent(sortedPaths[i])) {
        continue;
      } else {
        while (!rootPath.isRoot) {
          rootPath = rootPath.dir;
          if (!rootPath || rootPath.isEqualOrParent(sortedPaths[i])) {
            break;
          }
        }
      }
    }
    if (rootPath) {
      return TreeNode.getTreeNodeByPath(rootPath.toString());
    }

    return this.root;
  }

  private isItemVisibleAtRootSurface(node: TreeNode) {
    let parent: ITreeNodeOrCompositeTreeNode = node;
    while (parent.parent) {
      parent = parent.parent;
    }
    return (parent as CompositeTreeNode).isItemVisibleAtSurface(node);
  }

  /**
   * 检查节点是否可见，而不是被隐藏在节点中
   *
   * 这里的可见并不表示节点在当前视图中可见，而是在用户滚动到特定位置便可看见
   *
   * 隐藏在节点中可能的原因为其父节点中有一个以上处于折叠状态
   */
  public isItemVisibleAtSurface(item: ITreeNodeOrCompositeTreeNode): boolean {
    if (item === this) {
      return true;
    }
    return !!this._flattenedBranch && this._flattenedBranch.indexOf(item.id) > -1;
  }

  private transformToRelativePath(path: string): string[] {
    const { splitPath } = Path;
    const pathFlag = splitPath(path);
    pathFlag.shift();
    return pathFlag;
  }

  /**
   * 根据路径展开节点树
   * @memberof CompositeTreeNode
   */
  public async loadTreeNodeByPath(path: string, quiet = false): Promise<ITreeNodeOrCompositeTreeNode | undefined> {
    if (!CompositeTreeNode.isRoot(this)) {
      return;
    }
    const state = TreeNode.getGlobalTreeState(this.path);
    if (state.isExpanding) {
      return;
    }
    state.refreshCancelToken.cancel();
    state.loadPathCancelToken.cancel();
    const loadPathCancelToken = new CancellationTokenSource();
    TreeNode.setGlobalTreeState(this.path, {
      isLoadingPath: true,
      loadPathCancelToken,
    });
    const token = loadPathCancelToken.token;

    const flattenedBranchChilds: CompositeTreeNode[] = [];
    const { splitPath, isRelative } = Path;
    const pathFlag = isRelative(path) ? splitPath(path) : this.transformToRelativePath(path);
    if (pathFlag.length === 0) {
      TreeNode.setGlobalTreeState(this.path, {
        isLoadingPath: false,
      });
      return this;
    }
    if (!this.children) {
      await this.ensureLoaded(token);
    }
    if (token.isCancellationRequested) {
      TreeNode.setGlobalTreeState(this.path, {
        isLoadingPath: false,
      });
      return;
    }
    let next = this._children;
    let preItem: CompositeTreeNode | undefined;
    let preItemPath = '';
    let name;
    while (next && (name = pathFlag.shift())) {
      let item = next.find((c) => c.name.indexOf(name) === 0);
      if (item) {
        if (CompositeTreeNode.is(item)) {
          (item as CompositeTreeNode)._watcher.notifyWillChangeExpansionState(item, true);
          (item as CompositeTreeNode).isExpanded = true;
          if (!(item as CompositeTreeNode).children) {
            await (item as CompositeTreeNode).resolveChildrens(token);
            if (token.isCancellationRequested) {
              TreeNode.setGlobalTreeState(this.path, {
                isLoadingPath: false,
              });
              return;
            }
          }
          flattenedBranchChilds.push(item as CompositeTreeNode);
          (item as CompositeTreeNode)._watcher.notifyDidChangeExpansionState(item, true);
        }
        if (pathFlag.length === 0) {
          preItem = item as CompositeTreeNode;
          break;
        }
      }
      // 可能展开后路径发生了变化, 需要重新处理一下当前加载路径
      if (!item && preItem) {
        const compactPath = splitPath(preItem.name).slice(1);
        if (compactPath[0] === name) {
          compactPath.shift();
          while (compactPath.length > 0) {
            if (compactPath[0] === pathFlag[0]) {
              compactPath.shift();
              pathFlag.shift();
            } else {
              break;
            }
          }
          name = pathFlag.shift();
          item = next.find((c) => c.name.indexOf(name) === 0);
        }
      }
      // 最终加载到的路径节点
      if (!item || (!CompositeTreeNode.is(item) && pathFlag.length > 0)) {
        break;
      }
      if (CompositeTreeNode.is(item)) {
        const isCompactName = item.name.indexOf(Path.separator) > 0;
        if (isCompactName) {
          const compactPath = splitPath(item.name).slice(1);
          while (compactPath.length > 0) {
            if (compactPath[0] === pathFlag[0]) {
              compactPath.shift();
              pathFlag.shift();
            } else {
              break;
            }
          }
        }
        if (!(item as CompositeTreeNode)._children) {
          preItemPath = item.path;
          if (CompositeTreeNode.is(item)) {
            (item as CompositeTreeNode).isExpanded = true;
            if (!item.children) {
              await (item as CompositeTreeNode).resolveChildrens(token);
              if (token.isCancellationRequested) {
                TreeNode.setGlobalTreeState(this.path, {
                  isLoadingPath: false,
                });
                return;
              }
            }
            flattenedBranchChilds.push(item as CompositeTreeNode);
          }
        }
        if (item && pathFlag.length === 0) {
          preItem = item as CompositeTreeNode;
          break;
        } else {
          if (!!preItemPath && preItemPath !== item.path) {
            // 说明此时已发生了路径压缩，如从 a -> a/b/c
            // 需要根据路径变化移除对应的展开路径, 这里只需考虑短变长场景
            const prePaths = splitPath(preItemPath);
            const nextPaths = splitPath(item.path);
            if (nextPaths.length > prePaths.length) {
              pathFlag.splice(0, nextPaths.length - prePaths.length);
            }
          }
          next = (item as CompositeTreeNode)._children;
          preItem = item as CompositeTreeNode;
        }
      }
    }

    if (preItem) {
      let child;
      if (preItem.disposed) {
        TreeNode.setGlobalTreeState(this.path, {
          isLoadingPath: false,
        });
        return;
      }
      while ((child = flattenedBranchChilds.pop())) {
        (child as CompositeTreeNode).expandBranch(child, true);
        if (flattenedBranchChilds.length === 0) {
          this.updateTreeNodeCache(child as CompositeTreeNode);
        }
      }
      if (!quiet) {
        this.watcher.notifyDidUpdateBranch();
      }
      TreeNode.setGlobalTreeState(this.path, {
        isLoadingPath: false,
      });
      return preItem;
    }
    TreeNode.setGlobalTreeState(this.path, {
      isLoadingPath: false,
    });
  }

  /**
   * 根据节点获取节点ID下标位置
   * @param {number} id
   * @returns
   * @memberof CompositeTreeNode
   */
  public getIndexAtTreeNodeId(id: number) {
    if (this._flattenedBranch) {
      return this._flattenedBranch.indexOf(id);
    }
    return -1;
  }

  /**
   * 根据节点获取节点下标位置
   * @param {ITreeNodeOrCompositeTreeNode} node
   * @returns
   * @memberof CompositeTreeNode
   */
  public getIndexAtTreeNode(node: ITreeNodeOrCompositeTreeNode) {
    if (this._flattenedBranch) {
      return this._flattenedBranch.indexOf(node.id);
    }
    return -1;
  }

  /**
   * 根据下标位置获取节点
   * @param {number} index
   * @returns
   * @memberof CompositeTreeNode
   */
  public getTreeNodeAtIndex(index: number) {
    const id = this._flattenedBranch?.[index];
    if (!id) {
      return undefined;
    }
    return TreeNode.getTreeNodeById(id);
  }

  /**
   * 根据节点ID获取节点
   * @param {number} id
   * @returns
   * @memberof CompositeTreeNode
   */
  public getTreeNodeById(id: number) {
    return TreeNode.getTreeNodeById(id);
  }

  /**
   * 根据节点路径获取节点
   * @param {string} path
   * @returns
   * @memberof CompositeTreeNode
   */
  public getTreeNodeByPath(path: string) {
    return TreeNode.getTreeNodeByPath(path);
  }
}
