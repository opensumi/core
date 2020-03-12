import { ITreeNodeOrCompositeTreeNode, ITreeNode, ICompositeTreeNode, TreeNodeEvent, IWatcherEvent, MetadataChangeType, ITreeWatcher, IMetadataChange, ITree  } from '../types';
import { Event, Emitter, DisposableCollection } from '@ali/ide-core-common';
import { Path } from '@ali/ide-core-common/lib/path';

/**
 * 除了此方法不会抛出RangeError当项很多的时候，其余表现与Array.prototype.splice一样，
 *
 * 性能与Array.prototype.splice大致相同，某些场景如safari下表现更好
 *
 * @param arr 裁剪数组
 * @param start 起始位置
 * @param deleteCount 删除或替换位置
 * @param items 插入的数组
 */
function spliceTypedArray(arr: Uint32Array, start: number, deleteCount: number = 0, items?: Uint32Array | null) {
  const a = new Uint32Array((arr.length - deleteCount) + (items ? items.length : 0));
  a.set(arr.slice(0, start));
  if (items) {
    a.set(items, start);
  }
  a.set(arr.slice(start + deleteCount, arr.length), (start + (items ? items.length : 0)));
  return a;
}

export class TreeNode implements ITreeNode {
  public static nextId = (() => {
    let id = 0;
    return () => id++;
  })();

  public static getFileEntryById(id: number) {
    return TreeNode.idToTreeNode.get(id);
  }

  private static idToTreeNode: Map<number, TreeNode> = new Map();
  protected _uid: number;
  protected _depth: number;
  private _parent: ICompositeTreeNode | undefined;

  private _metadata: {
    [key: string]: any,
  };

  private _disposed: boolean;
  protected _watcher: ITreeWatcher;

  protected isSelected: boolean = false;

  protected isActivated: boolean = false;

  protected _tree: ITree;
  private resolvedPathCache: string;

  protected constructor(tree: ITree, parent?: ICompositeTreeNode, watcher?: ITreeWatcher, optionalMetadata?: { [key: string]: any }) {
    this._uid = TreeNode.nextId();
    this._parent = parent;
    this._tree = tree;
    this._disposed = false;
    this._metadata = { ...(optionalMetadata || {}) };
    this._depth = parent ? parent.depth + 1 : 0;
    TreeNode.idToTreeNode.set(this._uid, this);
  }

  get disposed() {
    return this._disposed;
  }

  get selected() {
    return this.isSelected;
  }

  get activated() {
    return this.isActivated;
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

  get id() {
    return this._uid;
  }

  get name() {
    return this.getMetadata('name');
  }

  set name(name: string) {
    this.addMetadata('name', name);
  }

  get description() {
    return this.getMetadata('description');
  }

  // 节点绝对路径
  get path(): string {
    if (!this.parent) {
      return new Path('root').toString();
    }
    if (!this.resolvedPathCache) {
      this.resolvedPathCache = new Path(this.parent.path).join(this.name).toString();
    }
    return this.resolvedPathCache;
  }

  public getMetadata(withKey: string): any {
    return this._metadata[withKey];
  }

  public addMetadata(withKey: string, value: any) {
    if (!(withKey in this._metadata)) {
      this._metadata[withKey] = value;
      this._watcher.notifyDidChangeMetadata(this, { type: MetadataChangeType.Added, key: withKey, prevValue: void 0, value });
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
      this._watcher.notifyDidChangeMetadata(this, { type: MetadataChangeType.Removed, key: withKey, prevValue, value: void 0 });
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
    if (to === null || !CompositeTreeNode.is(to)) { // that's the best check we can do; `parent instanceof Directory` causes a cyclic dependency
      this._parent = undefined;
      prevParent.unlinkItem(this);
      this.dispose();
      return;
    }
    const didChangeParent = prevParent !== to;
    const prevPath = this.path;

    this.resolvedPathCache = '';
    this._depth = to.depth + 1;

    if (didChangeParent || name !== this.name) {
      this.name = name;
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

  protected dispose() {
    if (this._disposed) { return; }
    this._watcher.notifyWillDispose(this);
    this._disposed = true;
    TreeNode.idToTreeNode.delete(this._uid);
    this._watcher.notifyDidDispose(this);
    this._watcher.dispose.dispose();
  }
}

export class CompositeTreeNode extends TreeNode implements ICompositeTreeNode {
  private static defaultSortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      return a.name > b.name ? 1
        : a.name < b.name ? -1
          : 0;
    }
    return CompositeTreeNode.is(a) ? -1
      : CompositeTreeNode.is(b)  ? 1
        : 0;
  }

  public static is(node: any): node is ICompositeTreeNode {
    return !!node && 'children' in node;
  }

  protected _children: ITreeNodeOrCompositeTreeNode[] = [];
  // 节点的分支数量
  protected _branchSize: number;
  protected flattenedBranch: Uint32Array | null;
  private isExpanded: boolean;
  private hardReloadPromise: Promise<void> | null;
  private hardReloadPResolver: (() => void) | null;

  protected generatorWatcher() {
    const emitter = new Emitter<any>();
    const onEventChanges: Event<any> = emitter.event;
    const disposeCollection = new DisposableCollection();
    const watcher: ITreeWatcher = {
      notifyWillProcessWatchEvent: (target: ICompositeTreeNode, event: IWatcherEvent) => {
        emitter.fire({type: TreeNodeEvent.WillProcessWatchEvent, args: [target, event]});
      },
      notifyWillChangeParent: (target: ITreeNodeOrCompositeTreeNode, prevParent: ICompositeTreeNode, newParent: ICompositeTreeNode) => {
        emitter.fire({type: TreeNodeEvent.WillChangeParent, args: [target, prevParent, newParent]});
      },
      notifyDidChangeParent: (target: ITreeNodeOrCompositeTreeNode, prevParent: ICompositeTreeNode, newParent: ICompositeTreeNode)  => {
        emitter.fire({type: TreeNodeEvent.DidChangeParent, args: [target, prevParent, newParent]});
      },
      notifyWillDispose: (target: ITreeNodeOrCompositeTreeNode)   => {
        emitter.fire({type: TreeNodeEvent.DidChangeParent, args: [target]});
      },
      notifyDidDispose: (target: ITreeNodeOrCompositeTreeNode)  => {
        emitter.fire({type: TreeNodeEvent.DidChangeParent, args: [target]});
      },
      notifyDidProcessWatchEvent: (target: ICompositeTreeNode, event: IWatcherEvent)  => {
        emitter.fire({type: TreeNodeEvent.DidProcessWatchEvent, args: [target, event]});
      },
      notifyDidChangePath: (target: ITreeNodeOrCompositeTreeNode)  => {
        emitter.fire({type: TreeNodeEvent.DidChangePath, args: [target]});
      },
      notifyWillChangeExpansionState: (target: ICompositeTreeNode, nowExpanded: boolean)   => {
        emitter.fire({type: TreeNodeEvent.WillChangeExpansionState, args: [target, nowExpanded]});
      },
      notifyDidChangeExpansionState: (target: ICompositeTreeNode, nowExpanded: boolean)  => {
        emitter.fire({type: TreeNodeEvent.DidChangeExpansionState, args: [target, nowExpanded]});
      },
      notifyDidChangeMetadata: (target: ITreeNode | ICompositeTreeNode, change: IMetadataChange)  => {
        emitter.fire({type: TreeNodeEvent.DidChangeMetadata, args: [target, change]});
      },
      on: (event: TreeNodeEvent, callback: any) => {
        disposeCollection.push(onEventChanges((data) => {
          if (data.type === event) {
            callback(...data.args);
          }
        }));
      },
      dispose: disposeCollection,
    };
    return watcher;
  }

  // parent 为undefined即表示该节点为根节点
  constructor(tree: ITree, parent: ICompositeTreeNode | undefined, watcher?: ITreeWatcher, optionalMetadata?: { [key: string]: any }) {
    super(tree, parent, watcher, optionalMetadata);
    this.isExpanded = false;
    this._branchSize = 0;
    if (!parent) {
      // 为根节点创建监听器
      this._watcher = this.generatorWatcher();
    } else {
      this._watcher = watcher as any;
    }
  }

  // 作为根节点唯一的watcher需要在生成新节点的时候传入
  get watcher() {
    return this._watcher;
  }

  get children() {
    return this._children ? this._children.slice() : null;
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
  public async setExpanded(ensureVisible = true) {
    if (this.isExpanded) {
      return;
    }
    this.isExpanded = true;
    if (this._children === null) {
      await this.hardReloadChildren();
      // 检查其是否展开；可能同时执行了setCollapsed方法
      if (!this.isExpanded) {
        return;
      }
    }

    if (ensureVisible && this.parent) {
      await (this.parent as CompositeTreeNode).setExpanded(true);
    }

    if (this.isExpanded) {
      this._watcher.notifyWillChangeExpansionState(this, true);
      // 与根节点合并分支
      this.expandBranch(this);
      this._watcher.notifyDidChangeExpansionState(this, true);
    }
  }

  // 折叠节点
  public setCollapsed() {
    if (!this.isExpanded) {
      return;
    }
    if (this._children && this.parent) {
      this._watcher.notifyWillChangeExpansionState(this, false);
      // 从根节点裁剪分支
      this.shrinkBranch(this);
    }
    this.isExpanded = false;

    this._watcher.notifyDidChangeExpansionState(this, false);
  }

  public mv(to: ICompositeTreeNode, name: string = this.name) {
    super.mv(to, name);
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
    if (this.children && this.children.indexOf(item) > -1) {
      return;
    }
    const branchSizeIncrease = 1 + ((item instanceof CompositeTreeNode && item.expanded) ? item._branchSize : 0);
    this._children.push(item);
    this._children.sort(CompositeTreeNode.defaultSortComparator);
    this._branchSize += branchSizeIncrease;
    let master: CompositeTreeNode = this;
    // 如果该节点无叶子节点，则继续往上查找合适的插入位置
    while (!master.flattenedBranch) {
      if (master.parent) {
        master = master.parent as CompositeTreeNode;
        master._branchSize += branchSizeIncrease;
      }
    }
    let relativeInsertionIndex = this._children.indexOf(item);
    const leadingSibling = this._children[relativeInsertionIndex - 1];
    if (leadingSibling) {
      const siblingIdx = master.flattenedBranch.indexOf(leadingSibling.id);
      relativeInsertionIndex = siblingIdx + ((leadingSibling instanceof CompositeTreeNode && leadingSibling.expanded) ? leadingSibling._branchSize : 0);
    } else {
      relativeInsertionIndex = master.flattenedBranch.indexOf(this.id);
    }
    // +1为了容纳自身节点位置，在插入节点下方插入新增节点
    const absInsertionIndex = relativeInsertionIndex + 1;

    const branch = new Uint32Array(branchSizeIncrease);
    branch[0] = item.id;
    if (item instanceof CompositeTreeNode && item.expanded && item.flattenedBranch) {
      branch.set(item.flattenedBranch, 1);
      item.setFlattenedBranch(null);
    }
    master.setFlattenedBranch(spliceTypedArray(master.flattenedBranch, absInsertionIndex, 0, branch));
  }

  /**
   * 从父节点中移除节点
   *
   * 直接调用此方法将不会触发onWillHandleWatchEvent和onDidHandleWatchEvent事件
   */
  public unlinkItem(item: ITreeNodeOrCompositeTreeNode, reparenting: boolean = false): void {
    const idx = this._children.indexOf(item);
    if (idx === -1) {
      return;
    }
    this._children.splice(idx, 1);
    const branchSizeDecrease = 1 + ((item instanceof CompositeTreeNode && item.expanded) ? item._branchSize : 0);
    this._branchSize -= branchSizeDecrease;
    // 如果该节点无叶子节点，则继续往上查找节点的父节点
    let master: CompositeTreeNode = this;
    while (!master.flattenedBranch) {
      if (master.parent) {
        master = master.parent as CompositeTreeNode;
        master._branchSize -= branchSizeDecrease;
      }
    }
    const removalBeginIdx = master.flattenedBranch.indexOf(item.id);
    if (removalBeginIdx === -1) {
      return;
    }

    if (item instanceof CompositeTreeNode && item.expanded) {
      item.setFlattenedBranch(master.flattenedBranch.slice(removalBeginIdx + 1, removalBeginIdx + branchSizeDecrease));
    }

    master.setFlattenedBranch(spliceTypedArray(
      master.flattenedBranch,
      removalBeginIdx,
      branchSizeDecrease));

    // 重新确认是否已正确移除节点
    if (!reparenting && item.parent === this) {
      item.mv(null);
    }
  }

  protected dispose() {
    if (this._children) {
      this._children.forEach((child) => (child as CompositeTreeNode).dispose());
    }
    super.dispose();
  }

  /**
   * 设置扁平化的分支信息
   */
  protected setFlattenedBranch(leaves: Uint32Array | null) {
    this.flattenedBranch = leaves;
  }

  /**
   * 展开分支
   * @param branch 分支节点
   */
  protected expandBranch(branch: CompositeTreeNode) {
    if (this !== branch) {
      this._branchSize += branch._branchSize;
    }
    // 当当前节点为折叠状态，更新分支信息
    if (this !== branch && this.flattenedBranch) {
      const injectionStartIdx = this.flattenedBranch.indexOf(branch.id) + 1;
      this.setFlattenedBranch(spliceTypedArray(this.flattenedBranch, injectionStartIdx, 0, branch.flattenedBranch));
      // 取消展开分支对于分支的所有权，即最终只会有顶部Root拥有所有分支信息
      branch.setFlattenedBranch(null);
    } else if (this.parent) {
      (this.parent as CompositeTreeNode).expandBranch(branch);
    }
  }

  /**
   * 折叠分支
   * @param branch 分支节点
   */
  protected shrinkBranch(branch: CompositeTreeNode) {
    if (this !== branch) {
      // `this`的分支大小没有改变，`this`仍然具有相同数量的叶子，但是从父级参照系（即根节点）来看，其分支缩小了
      this._branchSize -= branch._branchSize;
    }
    if (this !== branch && this.flattenedBranch) {
      const removalStartIdx = this.flattenedBranch.indexOf(branch.id) + 1;
      // 返回分支对于分支信息所有权，即将折叠的节点信息再次存储于折叠了的节点中
      branch.setFlattenedBranch(this.flattenedBranch.slice(removalStartIdx, removalStartIdx + branch._branchSize));
      this.setFlattenedBranch(spliceTypedArray(this.flattenedBranch, removalStartIdx, branch.flattenedBranch ? branch.flattenedBranch.length : 0));
    } else if (this.parent) {
      (this.parent as CompositeTreeNode).shrinkBranch(branch);
    }
  }

  /**
   * 加载节点信息
   * @memberof CompositeTreeNode
   */
  protected async hardReloadChildren() {
    if (this.hardReloadPromise) {
      return this.hardReloadPromise;
    }
    this.hardReloadPromise = new Promise((res) => this.hardReloadPResolver = res);
    this.hardReloadPromise.then(() => {
      this.hardReloadPromise = null;
      this.hardReloadPResolver = null;
    });

    const rawItems = await this._tree.resolveChildren(this) || [];
    if (this._children) {
      // 重置节点分支
      this.shrinkBranch(this);
    }
    const flatTree = new Uint32Array(rawItems.length);
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
    this.setFlattenedBranch(flatTree);
    if (this.hardReloadPResolver) {
      this.hardReloadPResolver();
    }
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
    return !!this.flattenedBranch && this.flattenedBranch.indexOf(item.id) > -1;
  }

  private walkPathTillRelative(path: string): string[] {
    const { splitPath } = Path;
    const pathfrags = splitPath(path);
    const rootPrefix = splitPath(this.path);
    let nextRootFrag;
    const matched: string[] = [];
    while (nextRootFrag = rootPrefix.shift()) {
      if (nextRootFrag === pathfrags[0]) {
        matched.push(pathfrags.shift() as string);
      }
    }
    return pathfrags;
  }

  /**
   * 根据路径展开节点树
   * @memberof CompositeTreeNode
   */
  public async forceLoadTreeNodeAtPath(path: string): Promise<ITreeNodeOrCompositeTreeNode | undefined> {
    const { splitPath, isRelative } = Path;
    const pathfrags = isRelative(path) ? splitPath(path) : this.walkPathTillRelative(path);
    if (pathfrags.length === 0) {
      return this;
    }
    await this.ensureLoaded();
    let next = this._children;
    let name;
    while (name = pathfrags.shift()) {
      const item = next.find((c) => c.name === name);
      if (item && pathfrags.length === 0) {
        return item;
      }
      // 异常情况
      if (!item || (!CompositeTreeNode.is(item) && pathfrags.length > 0)) {
        throw new Error(`'${path}' not found`);
      }
      if (CompositeTreeNode.is(item)) {
        if (!(item as CompositeTreeNode)._children) {
          await (item as CompositeTreeNode).hardReloadChildren();
        }
        next = (item as CompositeTreeNode)._children;
      }
    }
  }

}
