import { IDisposable } from '../../utils';

import { ITreeNode, ICompositeTreeNode, ITreeNodeOrCompositeTreeNode } from './tree-node';

export enum TreeNodeEvent {
  WillChangeExpansionState = 1,
  DidChangeExpansionState,
  WillChangeParent,
  DidChangeParent,
  WillDispose,
  DidDispose,
  BranchDidUpdate,
  DidChangePath,
  DidProcessWatchEvent,
  WillProcessWatchEvent,
  DidChangeMetadata,
  DidResolveChildren,
  WillResolveChildren,
}

export enum WatchEvent {
  /**
   * 节点添加事件
   */
  Added = 1,
  /**
   * 节点移除事件
   */
  Removed,
  /**
   * 避免过多的调用该事件
   * 该事件会执行较大成本的节点刷新
   */
  Changed,
  /**
   * 节点移动事件
   */
  Moved,
}

export interface IWatcherChangeEvent {
  type: WatchEvent.Changed;
  /**
   * 改变的节点路径
   */
  path: string;
}

export interface IWatcherAddEvent {
  type: WatchEvent.Added;
  /**
   * 改变的节点ID，这里一般为父节点ID
   */
  id: number;
  /**
   * 添加的节点
   */
  node: ITreeNode;
}

export interface IWatcherRemoveEvent {
  type: WatchEvent.Removed;
  /**
   * 移除的节点路径
   */
  path: string;
}

export interface IWatcherMoveEvent {
  type: WatchEvent.Moved;
  /**
   * 旧父节点路径
   */
  oldPath: string;
  /**
   * 新父节点路径
   */
  newPath: string;
}

export enum MetadataChangeType {
  Added = 1,
  Updated,
  Removed,
}

export interface IMetadataChange {
  type: MetadataChangeType;
  key: string;
  prevValue: any;
  value: any;
}

export interface IWatcherInfo {
  terminator: IWatchTerminator;
  callback: IWatcherCallback;
}

export type IWatchTerminator = (path?: string) => void;

export type IWatcherCallback = (event: IWatcherEvent) => void;

export type IWatcherEvent = IWatcherChangeEvent | IWatcherAddEvent | IWatcherRemoveEvent | IWatcherMoveEvent;

/**
 * 每个根节点都包含一个在根节点创建同时传入的`TreeSupervisor`
 *
 * 其存在是为了便于事件委派发生在树中某处以及其他共享内容（在树中共享，但对于每个“根”都是唯一的）事件
 */
export interface ITreeWatcher {
  // 监听watcheEvent事件，如节点移动，新建，删除
  onWatchEvent(path: string, callback: IWatcherCallback): IWatchTerminator;
  // 监听所有事件
  on(event: TreeNodeEvent, callback: any);

  // 事件分发

  notifyWillChangeParent(
    target: ITreeNodeOrCompositeTreeNode,
    prevParent: ICompositeTreeNode,
    newParent: ICompositeTreeNode,
  );
  notifyDidChangeParent(
    target: ITreeNodeOrCompositeTreeNode,
    prevParent: ICompositeTreeNode,
    newParent: ICompositeTreeNode,
  );

  notifyWillDispose(target: ITreeNodeOrCompositeTreeNode);
  notifyDidDispose(target: ITreeNodeOrCompositeTreeNode);

  notifyWillProcessWatchEvent(target: ICompositeTreeNode, event: IWatcherEvent);
  notifyDidProcessWatchEvent(target: ICompositeTreeNode, event: IWatcherEvent);

  notifyWillChangeExpansionState(target: ICompositeTreeNode, nowExpanded: boolean);
  notifyDidChangeExpansionState(target: ICompositeTreeNode, nowExpanded: boolean);

  notifyWillResolveChildren(target: ICompositeTreeNode, nowExpanded: boolean);
  notifyDidResolveChildren(target: ICompositeTreeNode, nowExpanded: boolean);

  notifyDidChangePath(target: ITreeNodeOrCompositeTreeNode);
  notifyDidChangeMetadata(target: ITreeNodeOrCompositeTreeNode, change: IMetadataChange);

  notifyDidUpdateBranch();

  dispose: IDisposable;
}
