import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';
import { INormalizedDocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { OutlineTreeService } from './services/outline-tree.service';

export class OutlineRoot extends CompositeTreeNode {

  static is(node: OutlineCompositeTreeNode | OutlineRoot): node is OutlineRoot {
    return !!node && !node.parent;
  }

  constructor(
    tree: OutlineTreeService,
  ) {
    super(tree as ITree, undefined);
  }

  get expanded() {
    return true;
  }
}

// OutlineCompositeTreeNode 节点不包含父节点, 同时默认为展开状态
export class OutlineCompositeTreeNode extends CompositeTreeNode {

  static is(node: OutlineCompositeTreeNode | OutlineTreeNode): node is OutlineCompositeTreeNode {
    return !!node && !!(node as OutlineCompositeTreeNode).raw && !!(node as OutlineCompositeTreeNode).raw.children?.length;
  }

  private _whenReady: Promise<void>;

  constructor(
    tree: OutlineTreeService,
    parent: OutlineCompositeTreeNode | OutlineRoot,
    public readonly raw: INormalizedDocumentSymbol,
    public readonly icon: string,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: raw.name }, { disableCache: false });
    this._whenReady = this.setExpanded(false, true);
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get displayName() {
    return this.raw.name;
  }

  get whenReady() {
    return this._whenReady;
  }
}

export class OutlineTreeNode extends TreeNode {
  constructor(
    tree: OutlineTreeService,
    parent: OutlineCompositeTreeNode | undefined,
    public readonly raw: INormalizedDocumentSymbol,
    public readonly icon: string,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name: raw.name }, { disableCache: false });
    this._uid = id || this._uid;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get displayName() {
    return this.raw.name;
  }
}
