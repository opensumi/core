import { TreeNode, CompositeTreeNode } from './tree-node';
import { Emitter, WaitUntilEvent, DisposableCollection, Mutable } from '@ali/ide-core-common';
import { ITreeNodeOrCompositeTreeNode, ITree } from '../types';

export class Tree implements ITree {
  protected _root: CompositeTreeNode | undefined;
  protected readonly onChangedEmitter = new Emitter<void>();
  protected readonly onNodeRefreshedEmitter = new Emitter<CompositeTreeNode & WaitUntilEvent>();
  protected readonly toDispose = new DisposableCollection();

  protected nodes: {
    [id: string]: Mutable<TreeNode> | undefined,
  } = {};

  constructor() {
    this.toDispose.push(this.onChangedEmitter);
    this.toDispose.push(this.onNodeRefreshedEmitter);
  }

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

  async resolveChildren(parent: CompositeTreeNode): Promise<ITreeNodeOrCompositeTreeNode[] | null> {
    return parent.children;
  }

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
