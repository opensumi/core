import { TreeNode, CompositeTreeNode } from './TreeNode';
import { Emitter, WaitUntilEvent, DisposableCollection, Mutable } from '@ali/ide-core-common';
import { ITreeNodeOrCompositeTreeNode, ITree } from '../types';

export abstract class Tree implements ITree {
  protected _root: CompositeTreeNode | undefined;
  protected readonly onChangedEmitter = new Emitter<void>();
  protected readonly onNodeRefreshedEmitter = new Emitter<CompositeTreeNode & WaitUntilEvent>();
  protected readonly toDispose = new DisposableCollection();

  protected nodes: {
    [id: string]: Mutable<TreeNode> | undefined,
  } = {};

  dispose(): void {
    this.toDispose.dispose();
  }

  get root(): CompositeTreeNode | undefined {
    return this._root;
  }

  set root(root: CompositeTreeNode | undefined) {
    this._root = root;
    if (this.root) {
      this.root.ensureLoaded();
    }
  }

  protected fireChanged(): void {
    this.onChangedEmitter.fire(undefined);
  }

  abstract async resolveChildren(parent?: CompositeTreeNode): Promise<ITreeNodeOrCompositeTreeNode[] | null>;

  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (a.constructor === b.constructor) {
      return a.name > b.name ? 1
        : a.name < b.name ? -1
          : 0;
    }
    return CompositeTreeNode.is(a) ? -1
      : CompositeTreeNode.is(b)  ? 1
        : 0;
  }
}
