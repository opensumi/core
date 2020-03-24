import { Event, Emitter } from '@ali/ide-core-common';
import { ISerializableState, TreeStateManager, TreeStateWatcher } from './treeState';
import { CompositeTreeNode, TreeNode } from '../TreeNode';
import { ICompositeTreeNode, TreeNodeEvent, ITreeNodeOrCompositeTreeNode } from '../../types';

export class TreeModel {

  private _state: TreeStateManager;
  private _root: CompositeTreeNode;

  private onChangeEmitter: Emitter<void> = new Emitter();

  get onChange(): Event<void> {
    return this.onChangeEmitter.event;
  }

  get root() {
    return this._root;
  }

  set root(root: CompositeTreeNode) {
    this._root = root;
    this.initState(root);
  }

  get state() {
    return this._state;
  }

  set state(state: TreeStateManager) {
    this._state = state;
  }

  init(root: CompositeTreeNode) {
    this.root = root;
    // 分支更新时通知树刷新
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, this.dispatchChange);
  }

  initState(root: ICompositeTreeNode) {
    this.state = new TreeStateManager(root as CompositeTreeNode);
  }

  dispatchChange = () => {
    this.onChangeEmitter.fire();
  }

  /**
   * 根据给定的状态信息还原Tree组件
   *
   * TreeState中包含:
   *  - 可展开节点的展开状态
   *  - 滚动偏移
   *
   * TreeState中不包含:
   *  - 装饰器
   *  - 临时的输入框节点
   *
   */
  public async loadTreeState(state: ISerializableState | string) {
    if (typeof state === 'string') {
      state = JSON.parse(state);
    }
    return this.state.loadTreeState(state as ISerializableState);
  }

  /**
   * 返回一个与实际树状态同步的`TreeStateWatcher`
   *
   * TreeState中包含:
   *  - 可展开节点的展开状态
   *  - 滚动偏移
   *
   * TreeState中不包含:
   *  - 装饰器
   *  - 临时的输入框节点
   *
   * `TreeStateWatcher#onDidChange` 用于在状态变更时绑定监听函数
   *
   * `TreeStateWatcher#snapshot` 用于获取当前树的快照信息（用于状态恢复），返回state对象
   *
   * `TreeStateWatcher#toString` 用于将当前状态转换为JSON字符串
   */
  public getTreeStateWatcher(atSurfaceExpandedDirsOnly: boolean = false): TreeStateWatcher {
    return new TreeStateWatcher(this.state, atSurfaceExpandedDirsOnly);
  }

  public async refresh(parent: CompositeTreeNode) {
    if (!CompositeTreeNode.is(parent)) {
      parent = this.root;
    }
    const children = await this.resolveChildren(parent);
    const result = await this.setChildren(parent, children);
    this.dispatchChange();
    return result;
  }

  protected resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
    return Promise.resolve(Array.from(parent.children!) as TreeNode[]);
  }

  protected setChildren(parent: CompositeTreeNode, children: TreeNode[]) {
    this.removeNode(parent);

  }

  protected removeNode(node: TreeNode) {
    if (CompositeTreeNode.is(node) && !!node.children) {
      node.children.forEach((child) => this.removeNode(child as TreeNode));
    }
    if (node) {
      (child as TreeNode).dispose();
      delete this.nodes[node.id];
    }
  }

  protected getRootNode(node: ITreeNodeOrCompositeTreeNode) {
    if (!node.parent) {
      return node;
    } else {
      return this.getRootNode(node.parent);
    }
  }
}
