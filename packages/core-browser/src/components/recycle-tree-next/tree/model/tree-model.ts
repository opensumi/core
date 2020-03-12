import { Event, Emitter } from '@ali/ide-core-common';
import { ISerializableState, TreeStateManager, TreeStateWatcher } from './treeState';
import { CompositeTreeNode } from '../tree-node';
import { ITree } from '../../types';

export class TreeModel {

  public readonly state: TreeStateManager;
  public readonly root: CompositeTreeNode;

  private onChangeEmitter: Emitter<void> = new Emitter();

  get onChange(): Event<void> {
    return this.onChangeEmitter.event;
  }

  constructor(tree: ITree) {
    this.root = new CompositeTreeNode(tree, undefined);
    this.state = new TreeStateManager(this.root);
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
  public async loadTreeState(state: string);
  // tslint:disable-next-line:unified-signatures
  public async loadTreeState(state: ISerializableState);
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
}
