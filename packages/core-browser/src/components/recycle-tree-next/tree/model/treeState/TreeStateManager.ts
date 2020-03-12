import { Event, Emitter } from '@ali/ide-core-common';
import { ISerializableState } from './types';
import { CompositeTreeNode, TreeNode } from '../../tree-node';
import { TreeNodeEvent, ITreeNodeOrCompositeTreeNode } from '../../../types';
import { Path } from '@ali/ide-core-common/lib/path';

export enum Operation {
  SetExpanded = 1,
  SetCollapsed,
  SetActive,
}

enum StashKeyFrameFlag {
  Expanded = 1,
  Collapsed = 2,
  Disabled = 4,
}

export interface IPathChange {
  prevPath: string;
  newPath: string;
}

export interface IExpansionStateChange {
  relativePath: string;
  isExpanded: boolean;
  isVisibleAtSurface: boolean;
}

export class TreeStateManager {
  private root: CompositeTreeNode;
  private expandedDirectories: Map<CompositeTreeNode, string> = new Map();
  private _scrollOffset: number = 0;
  private stashing: boolean = false;
  private stashKeyframes: Map<number, StashKeyFrameFlag>;
  private stashLockingItems: Set<TreeNode> = new Set();

  private onDidChangeScrollOffsetEmitter: Emitter<number> = new Emitter();
  private onDidLoadStateEmitter: Emitter<void> = new Emitter();
  private onChangeScrollOffsetEmitter: Emitter<number> = new Emitter();
  private onDidChangeExpansionStateEmitter: Emitter<IExpansionStateChange> = new Emitter();
  private onDidChangeRelativePathEmitter: Emitter<IPathChange> = new Emitter();
  constructor(root: CompositeTreeNode) {
    this.root = root;
    // 监听节点的折叠展开状态变化
    this.root.watcher.on(TreeNodeEvent.DidChangeExpansionState, this.handleExpansionChange);
    this.root.watcher.on(TreeNodeEvent.DidChangePath, this.handleDidChangePath);

  }

  get scrollOffset() {
    return this._scrollOffset;
  }

  public saveScrollOffset(scrollOffset: number) {
    this._scrollOffset = scrollOffset;
    this.onDidChangeScrollOffsetEmitter.fire(scrollOffset);
  }

  get onDidLoadState(): Event<void> {
    return this.onDidLoadStateEmitter.event;
  }

  get onChangeScrollOffset(): Event<number> {
    return this.onChangeScrollOffsetEmitter.event;
  }

  get onDidChangeExpansionState(): Event<IExpansionStateChange> {
    return this.onDidChangeExpansionStateEmitter.event;
  }

  get onDidChangeRelativePath(): Event<IPathChange> {
    return this.onDidChangeRelativePathEmitter.event;
  }

  public async loadTreeState(state: ISerializableState) {
    if (state) {
      for (const relPath of state.expandedDirectories.buried) {
        try {
          const node = await this.root.forceLoadTreeNodeAtPath(relPath);
          if (node && CompositeTreeNode.is(node) ) {
            await (node as CompositeTreeNode).setExpanded(false);
          }
        } catch (error) { }
      }
      for (const relPath of state.expandedDirectories.atSurface) {
        try {
          const node = await this.root.forceLoadTreeNodeAtPath(relPath);
          if (node && CompositeTreeNode.is(node)) {
            await (node as CompositeTreeNode).setExpanded(true);
          }
        } catch (error) { }
      }
      this._scrollOffset = typeof state.scrollPosition === 'number' && state.scrollPosition > -1 ? state.scrollPosition : this._scrollOffset;
      this.onDidLoadStateEmitter.fire();
    }
  }

  /**
   * 确保在调用`reverseStash`时，目录扩展不会被更改，以免导致节点内文件被排除
   */
  public excludeFromStash(file: ITreeNodeOrCompositeTreeNode) {
    if (this.stashKeyframes && !this.stashing) {
      this.handleExpansionChange(file.constructor === TreeNode ? file.parent as CompositeTreeNode : file as CompositeTreeNode, true, this.root.isItemVisibleAtSurface(file));
    }
  }

  private handleExpansionChange = (target: CompositeTreeNode, isExpanded: boolean, isVisibleAtSurface: boolean) => {
    if (this.stashing) {
      this.stashKeyframes.set(target.id, isExpanded ? StashKeyFrameFlag.Expanded : StashKeyFrameFlag.Collapsed);
    }
    if (this.stashKeyframes && !this.stashing) {
      // 如果用户通过交互手动修改了展开属性，则需要在记录结束后将其父节点从撤销队列中移除
      if (isExpanded) {
        let p: CompositeTreeNode = target;
        while (p) {
          if (this.stashKeyframes.has(p.id)) {
            let flags = this.stashKeyframes.get(p.id) as StashKeyFrameFlag;
            // tslint:disable-next-line:no-bitwise
            flags = flags | StashKeyFrameFlag.Disabled;
            this.stashKeyframes.set(p.id, flags as StashKeyFrameFlag);
          }
          p = p.parent as CompositeTreeNode;
        }
        this.stashLockingItems.add(target);
      }
      if (this.stashLockingItems && this.stashLockingItems.has(target) && !isExpanded) {
        let p: CompositeTreeNode = target;
        while (p) {
          if (this.stashKeyframes.has(p.id)) {
            let flags = this.stashKeyframes.get(p.id) as StashKeyFrameFlag;
            // tslint:disable-next-line:no-bitwise
            flags &= ~StashKeyFrameFlag.Disabled;
            this.stashKeyframes.set(p.id, flags);
          }
          p = p.parent as CompositeTreeNode;
        }
        this.stashLockingItems.delete(target);
      }
    }
    let relativePath = this.expandedDirectories.get(target);
    if (isExpanded && !relativePath) {
      relativePath = new Path(this.root.path).relative(new Path(target.path))?.toString() as string;
      this.expandedDirectories.set(target, relativePath);
      this.onDidChangeExpansionStateEmitter.fire({relativePath, isExpanded, isVisibleAtSurface});
    } else if (!isExpanded && relativePath) {
      this.expandedDirectories.delete(target);
      this.onDidChangeExpansionStateEmitter.fire({relativePath, isExpanded, isVisibleAtSurface});
    }
  }

  private handleDidChangePath = (target: CompositeTreeNode) => {
    if (this.expandedDirectories.has(target)) {
      const prevPath = this.expandedDirectories.get(target) as string;
      const newPath = new Path(this.root.path).relative(new Path(target.path))?.toString() as string;
      this.expandedDirectories.set(target, newPath);
      this.onDidChangeRelativePathEmitter.fire({prevPath, newPath});
    }
  }
}
