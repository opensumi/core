import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { MaybeNull, URI } from '@opensumi/ide-core-common';
import { INormalizedDocumentSymbol } from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';

import { OutlineTreeService } from './services/outline-tree.service';
export class OutlineRoot extends CompositeTreeNode {
  static is(node: OutlineCompositeTreeNode | OutlineRoot): node is OutlineRoot {
    return !!node && !node.parent;
  }

  private _currentUri: MaybeNull<URI>;

  constructor(tree: OutlineTreeService, currentUri: MaybeNull<URI>) {
    super(tree as ITree, undefined);
    this._currentUri = currentUri;
  }

  get currentUri() {
    return this._currentUri;
  }

  get expanded() {
    return true;
  }
}

// OutlineCompositeTreeNode 节点不包含父节点, 同时默认为展开状态
export class OutlineCompositeTreeNode extends CompositeTreeNode {
  static is(node: OutlineCompositeTreeNode | OutlineTreeNode): node is OutlineCompositeTreeNode {
    return (
      !!node && !!(node as OutlineCompositeTreeNode).raw && !!(node as OutlineCompositeTreeNode).raw.children?.length
    );
  }

  constructor(
    tree: OutlineTreeService,
    parent: OutlineCompositeTreeNode | OutlineRoot,
    public readonly raw: INormalizedDocumentSymbol,
    public readonly icon: string,
  ) {
    super(tree as ITree, parent, undefined, {});
    this.isExpanded = true;
  }

  get displayName() {
    return this.raw.name;
  }
}

export class OutlineTreeNode extends TreeNode {
  static is(node: OutlineTreeNode): node is OutlineTreeNode {
    return !!node && !!(node as OutlineTreeNode).raw;
  }

  constructor(
    tree: OutlineTreeService,
    parent: OutlineCompositeTreeNode | OutlineRoot,
    public readonly raw: INormalizedDocumentSymbol,
    public readonly icon: string,
  ) {
    super(tree as ITree, parent, undefined, {});
  }

  get displayName() {
    return this.raw.name;
  }
}
