import { Event, Emitter, DisposableCollection, Path } from '../../utils';
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

export type TreeNodeOrCompositeTreeNode = TreeNode | CompositeTreeNode;

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

  public static idToTreeNode: Map<number, ITreeNodeOrCompositeTreeNode> = new Map();
  public static pathToTreeNode: Map<string, ITreeNodeOrCompositeTreeNode> = new Map();

  protected _uid: number;
  protected _depth: number;
  private _parent: ICompositeTreeNode | undefined;

  private _metadata: {
    [key: string]: any;
  };

  private _disposed: boolean;
  protected _watcher: ITreeWatcher;

  protected _tree: ITree;
  protected _visible: boolean;

  protected constructor(
    tree: ITree,
    parent?: ICompositeTreeNode,
    watcher?: ITreeWatcher,
    optionalMetadata?: { [key: string]: any },
    options?: { disableCache?: boolean },
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
    if (!(options && options.disableCache)) {
      TreeNode.setTreeNode(this._uid, this.path, this);
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

  get whenReady() {
    // 保障节点是否完成的标识位
    return (async () => {})();
  }

  get type() {
    return TreeNodeType.TreeNode;
  }

  get id() {
    return this._uid;
  }

  get name() {
    // 根节点保证路径不重复
    if (!this.parent) {
      return `root_${this._uid}`;
    }
    return this.getMetadata('name');
  }

  set name(name: string) {
    this.addMetadata('name', name);
  }

  // 节点绝对路径
  get path(): string {
    if (!this.parent) {
      return new Path(`/${this.name}`).toString();
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

  protected dispose() {
    if (this._disposed) {
      return;
    }
    this._watcher.notifyWillDispose(this);
    TreeNode.removeTreeNode(this._uid, this.path);
    this._watcher.notifyDidDispose(this);
    this._disposed = true;
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

  protected _children: ITreeNodeOrCompositeTreeNode[] | null = null;
  // 节点的分支数量
  private _branchSize: number;
  private _flattenedBranch: number[] | null;
  private isExpanded: boolean;
  private hardReloadPromise: Promise<void> | null;
  private hardReloadPResolver: (() => void) | null;

  private refreshTasks: string[][] = [];
  private activeRefreshPromise: Promise<any> | null;
  private queuedRefreshPromise: Promise<any> | null;
  private queuedRefreshPromiseFactory: (() => Promise<any>) | null;

  private _lock = false;

  private watchTerminator: (path: string) => void;
  public watchEvents: Map<string, IWatcherInfo>;

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
      notifyWillDispose: (target: ITreeNodeOrCompositeTreeNode) => {
        emitter.fire({ type: TreeNodeEvent.DidChangeParent, args: [target] });
      },
      notifyDidDispose: (target: ITreeNodeOrCompositeTreeNode) => {
        emitter.fire({ type: TreeNodeEvent.DidChangeParent, args: [target] });
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
    parent: ICompositeTreeNode | undefined,
    watcher?: ITreeWatcher,
    optionalMetadata?: { [key: string]: any },
    options?: { disableCache?: boolean },
  ) {
    super(tree, parent, watcher, optionalMetadata, options);
    this.isExpanded = parent ? false : true;
    this._branchSize = 0;
    if (!parent) {
      this.watchEvents = new Map();
      // 为根节点创建监听器
      this._watcher = this.generatorWatcher();
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
      return `root_${this._uid}`;
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

  /**
   * 确保此“目录”的子级已加载（不影响“展开”状态）
   * 如果子级已经加载，则返回的Promise将立即解决
   * 否则，将发出重新加载请求并返回Promise
   * 一旦返回的Promise.resolve，“CompositeTreeNode＃children” 便可以访问到对于节点
   */
  public async ensureLoaded() {
    if (this._children) {
      return;
    }
    return this.hardReloadChildren();
  }

  // 展开节点
  public async setExpanded(ensureVisible = true, quiet = false) {
    // 根节点不可折叠
    if (CompositeTreeNode.isRoot(this)) {
      return;
    }
    if (this.isExpanded) {
      return;
    }
    this.isExpanded = true;
    if (this._children === null) {
      !quiet && this._watcher.notifyWillResolveChildren(this, this.isExpanded);
      await this.hardReloadChildren();
      !quiet && this._watcher.notifyDidResolveChildren(this, this.isExpanded);
      // 检查其是否展开；可能同时执行了 setCollapsed 方法
      if (!this.isExpanded) {
        return;
      }
    }

    if (ensureVisible && this.parent && CompositeTreeNode.is(this.parent)) {
      await (this.parent as CompositeTreeNode).setExpanded(true, !quiet);
    }

    if (this.isExpanded) {
      !quiet && this._watcher.notifyWillChangeExpansionState(this, true);
      // 与根节点合并分支
      this.expandBranch(this, quiet);
      !quiet && this._watcher.notifyDidChangeExpansionState(this, true);
    }
  }

  // 获取当前节点下所有展开的节点路径
  private getAllExpandedNodePath() {
    let paths: string[] = [];
    if (this.children) {
      for (const child of this.children) {
        if ((child as CompositeTreeNode).isExpanded) {
          paths.push(child.path);
          paths = paths.concat((child as CompositeTreeNode).getAllExpandedNodePath());
        }
      }
      return paths;
    } else {
      return paths;
    }
  }

  // 获取当前节点下所有折叠的节点路径
  private getAllCollapsedNodePath() {
    let paths: string[] = [];
    if (this.children) {
      for (const child of this.children) {
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

  // 静默刷新子节点, 即不触发分支更新事件
  private async forceReloadChildrenQuiet(expandedPaths: string[] = this.getAllExpandedNodePath(), needReload = true) {
    let forceLoadPath;
    if (this.isExpanded) {
      if (needReload) {
        await this.hardReloadChildren(true);
      }
      while ((forceLoadPath = expandedPaths.shift())) {
        const relativePath = new Path(this.path).relative(new Path(forceLoadPath));
        if (!relativePath) {
          break;
        }
        const child = TreeNode.getTreeNodeByPath(forceLoadPath);

        if (!child) {
          if (!this.children) {
            break;
          }
          for (const child of this.children) {
            if (forceLoadPath.indexOf(child.path) === 0 && CompositeTreeNode.is(child)) {
              // 包含压缩节点的情况
              // 加载路径包含当前判断路径，尝试加载该节点再匹配
              await (child as CompositeTreeNode).hardReloadChildren(true);
              if ((child as CompositeTreeNode).isExpanded) {
                // 说明此时节点初始化时已默认展开，不需要进一步处理
                continue;
              }
              (child as CompositeTreeNode).isExpanded = true;
              if (expandedPaths.length > 0) {
                // 不需要重新reload压缩节点的子节点内容
                await (child as CompositeTreeNode).forceReloadChildrenQuiet(expandedPaths, false);
              } else {
                (child as CompositeTreeNode).expandBranch(child as CompositeTreeNode, true);
              }
              break;
            }
          }
        } else if (CompositeTreeNode.is(child)) {
          if ((child as CompositeTreeNode).whenReady) {
            await (child as CompositeTreeNode).whenReady;
          }
          if ((child as CompositeTreeNode).isExpanded) {
            // 说明此时节点初始化时已默认展开，不需要进一步处理
            continue;
          }
          (child as CompositeTreeNode).isExpanded = true;
          if (expandedPaths.length > 0) {
            await (child as CompositeTreeNode).forceReloadChildrenQuiet(expandedPaths);
          } else {
            await (child as CompositeTreeNode).hardReloadChildren(true);
            (child as CompositeTreeNode).expandBranch(child as CompositeTreeNode, true);
          }
        }
      }

      if (forceLoadPath) {
        expandedPaths.unshift(forceLoadPath);
        this.expandBranch(this, true);
      } else if (CompositeTreeNode.isRoot(this)) {
        // 通知分支树已更新
        this.watcher.notifyDidUpdateBranch();
      } else {
        // 这种情况一般为非根节点刷新后需同步到父节点，更新分支树
        this.expandBranch(this);
      }
    } else {
      // 仅需处理存在子节点的情况，否则将会影响刷新后的节点长度
      if (this.children) {
        // 清理子节点，等待下次展开时更新
        if (!!this.children && this.parent) {
          for (const child of this.children) {
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
        await (item as CompositeTreeNode).setCollapsed(true);
      }
    }
    // 通知分支树已更新
    this.watcher.notifyDidUpdateBranch();
  }

  // 折叠节点
  public setCollapsed(quiet = false) {
    // 根节点不可折叠
    if (CompositeTreeNode.isRoot(this)) {
      return;
    }
    if (!this.isExpanded) {
      return;
    }
    if (this._children && this.parent) {
      !quiet && this._watcher.notifyWillChangeExpansionState(this, false);
      // 从根节点裁剪分支
      this.shrinkBranch(this, quiet);
    }
    this.isExpanded = false;

    !quiet && this._watcher.notifyDidChangeExpansionState(this, false);
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
      for (const child of this.children) {
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
    let master: CompositeTreeNode = this;
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
    let relativeInsertionIndex = this._children!.indexOf(item);
    let absInsertionIndex;
    const leadingSibling = this._children![relativeInsertionIndex - 1];
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
    const idx = this._children!.indexOf(item);
    if (idx === -1) {
      return;
    }
    // 当删除时父节点已不存在界面上时，跳过插入操作
    if (!this.isItemVisibleAtRootSurface(this)) {
      return;
    }
    this._children!.splice(idx, 1);
    const branchSizeDecrease = 1 + (item instanceof CompositeTreeNode && item.expanded ? item._branchSize : 0);
    this._branchSize -= branchSizeDecrease;
    // 逐级往上查找节点的父节点，并沿途裁剪分支数
    let master: CompositeTreeNode = this;
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
    const item = this._children!.find((c) => c.name === name);
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
  }

  protected dispose() {
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
    this._lock = true;
    this._flattenedBranch = leaves;
    // Root节点才通知更新
    if (CompositeTreeNode.isRoot(this) && !withoutNotify) {
      this.watcher.notifyDidUpdateBranch();
    }
    this._lock = false;
  }

  /**
   * 展开分支节点
   * @param branch 分支节点
   */
  protected expandBranch(branch: CompositeTreeNode, withoutNotify?: boolean) {
    if (this !== branch) {
      // 但节点为展开状态时进行裁剪
      this._branchSize += branch._branchSize;
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
      if (!this.lock) {
        this.setFlattenedBranch(
          spliceArray(this._flattenedBranch, injectionStartIdx, 0, branch._flattenedBranch),
          withoutNotify,
        );
      }
      // 取消展开分支对于分支的所有权，即最终只会有顶部Root拥有所有分支信息
      if (!branch.lock) {
        branch.setFlattenedBranch(null, withoutNotify);
      }
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
      if (!branch.lock) {
        // 返回分支对于分支信息所有权，即将折叠的节点信息再次存储于折叠了的节点中
        branch.setFlattenedBranch(
          this._flattenedBranch.slice(removalStartIdx, removalStartIdx + branch._branchSize),
          withoutNotify,
        );
      }
      if (!this.lock) {
        this.setFlattenedBranch(
          spliceArray(
            this._flattenedBranch,
            removalStartIdx,
            branch._flattenedBranch ? branch._flattenedBranch.length : 0,
          ),
          withoutNotify,
        );
      }
    } else if (this.parent) {
      (this.parent as CompositeTreeNode).shrinkBranch(branch, withoutNotify);
    }
  }

  /**
   * 加载节点信息
   * @memberof CompositeTreeNode
   */
  public async hardReloadChildren(quiet?: boolean) {
    if (this.hardReloadPromise) {
      return this.hardReloadPromise;
    }
    this.hardReloadPromise = new Promise((res) => (this.hardReloadPResolver = res));
    this.hardReloadPromise.then(() => {
      this.hardReloadPromise = null;
      this.hardReloadPResolver = null;
    });

    let rawItems;

    try {
      rawItems = (await this._tree.resolveChildren(this)) || [];
    } catch (e) {
      rawItems = [];
    }

    if (this._children) {
      // 重置节点分支
      this.shrinkBranch(this, quiet);
    }

    const flatTree = new Array(rawItems.length);
    this._children = Array(rawItems.length);
    for (let i = 0; i < rawItems.length; i++) {
      const child = rawItems[i];
      this._children[i] = child;
    }

    this._children.sort(this._tree.sortComparator || CompositeTreeNode.defaultSortComparator);

    for (let i = 0; i < rawItems.length; i++) {
      flatTree[i] = this._children[i].id;
    }
    this._branchSize = flatTree.length;
    this.setFlattenedBranch(flatTree, quiet);
    // 清理上一次监听函数
    if (typeof this.watchTerminator === 'function') {
      this.watchTerminator(this.path);
    }
    this.watchTerminator = this.watcher.onWatchEvent(this.path, this.handleWatchEvent);
    if (this.hardReloadPResolver) {
      this.hardReloadPResolver();
    }
  }

  /**
   * 处理Watch事件，同时可通过外部手动调 g用节点更新函数进行节点替换，这里为通用的事件管理
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
      // 预存展开目录
      const expandedPaths = this.getAllExpandedNodePath();
      //  Changed事件，表示节点有较多的变化时，重新更新当前Tree节点
      if (this.children) {
        for (const child of this.children) {
          (child as CompositeTreeNode).dispose();
        }
      }
      // 如果当前变化的节点已在数据视图（并非滚动到不可见区域）中不可见，则将该节点折叠，待下次更新即可，
      if (!this.isItemVisibleAtRootSurface(this)) {
        this.isExpanded = false;
        this._children = null;
      } else {
        // needReload --- 判断根目录是否需要进行一次刷新，部分情况，如压缩目录下的文件创建后不应该刷新
        await this.refresh(expandedPaths);
      }
    }
    this.watcher.notifyDidProcessWatchEvent(this, event);
  };

  public async refresh(paths: string[] = this.getAllExpandedNodePath()) {
    this.refreshTasks.push(paths);
    return await this.queue(this.doRefresh.bind(this));
  }

  private async queue<T>(promiseFactory: () => Promise<T>) {
    if (this.activeRefreshPromise) {
      this.queuedRefreshPromiseFactory = promiseFactory;

      if (!this.queuedRefreshPromise) {
        const onComplete = () => {
          this.queuedRefreshPromise = null;

          const result = this.queue(this.queuedRefreshPromiseFactory!);
          this.queuedRefreshPromiseFactory = null;

          return result;
        };

        this.queuedRefreshPromise = new Promise((resolve) => {
          this.activeRefreshPromise!.then(onComplete, onComplete).then(resolve);
        });
      }

      return new Promise((c, e) => {
        this.queuedRefreshPromise!.then(c, e);
      });
    }

    this.activeRefreshPromise = promiseFactory();

    return new Promise((c, e) => {
      this.activeRefreshPromise!.then(
        (result: any) => {
          this.activeRefreshPromise = null;
          c(result);
        },
        (err: any) => {
          this.activeRefreshPromise = null;
          e(err);
        },
      );
    });
  }

  private async doRefresh() {
    const tasks = this.refreshTasks.slice(0);
    this.refreshTasks = [];
    const paths = this.mergeExpandedPaths(tasks);
    return await this.forceReloadChildrenQuiet(paths);
  }

  private mergeExpandedPaths(paths: string[][]) {
    // 返回最长的刷新路径即可
    let result;
    for (const path of paths) {
      if (!result) {
        result = path;
        continue;
      } else {
        if (path.length > result.length) {
          result = path;
        }
      }
    }
    return result;
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
  public async forceLoadTreeNodeAtPath(path: string): Promise<ITreeNodeOrCompositeTreeNode | undefined> {
    const { splitPath, isRelative } = Path;
    const pathFlag = isRelative(path) ? splitPath(path) : this.transformToRelativePath(path);
    if (pathFlag.length === 0) {
      return this;
    }
    await this.ensureLoaded();
    let next = this._children;
    let preItem: CompositeTreeNode;
    let preItemPath = '';
    let name;
    while ((name = pathFlag.shift())) {
      let item = next!.find((c) => c.name.indexOf(name) === 0);
      if (item && pathFlag.length === 0) {
        return item;
      }
      // 可能展开后路径发生了变化, 需要重新处理一下当前加载路径
      if (!item && preItem!) {
        const compactPath = splitPath(preItem!.name).slice(1);
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
          item = next!.find((c) => c.name.indexOf(name) === 0);
        }
      }
      // 最终加载到的路径节点
      if (!item || (!CompositeTreeNode.is(item) && pathFlag.length > 0)) {
        return preItem!;
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
            await (item as CompositeTreeNode).setExpanded(true, true);
          }
        }
        if (item && pathFlag.length === 0) {
          return item;
        } else {
          if (!!preItemPath && preItemPath !== item.path) {
            // 说明此时已发生了路径压缩，如从 a -> a/b/c
            // 需要根据路径变化移除对应的展开路径, 这里只需考虑短变长场景
            const prePaths = Path.splitPath(preItemPath);
            const nextPaths = Path.splitPath(item.path);
            if (nextPaths.length > prePaths.length) {
              pathFlag.splice(0, nextPaths.length - prePaths.length);
            }
          }
          next = (item as CompositeTreeNode)._children;
          preItem = item as CompositeTreeNode;
        }
      }
    }
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
    const id = this._flattenedBranch![index];
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
