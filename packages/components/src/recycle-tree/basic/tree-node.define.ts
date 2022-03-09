import { CompositeTreeNode, TreeNode } from '../tree';
import { ITree } from '../types';

import { IBasicTreeData } from './types';

export class BasicTreeRoot extends CompositeTreeNode {
  private _raw: IBasicTreeData;
  constructor(tree: ITree, parent: BasicCompositeTreeNode | undefined, data: IBasicTreeData) {
    super(tree, parent);
    this._raw = data;
  }

  get name() {
    return `BasicTreeRoot_${this._uid}`;
  }

  get raw() {
    return this._raw;
  }

  get expanded() {
    return true;
  }
}

export class BasicCompositeTreeNode extends CompositeTreeNode {
  private _displayName: string;
  private _whenReady: Promise<void>;
  private _raw: IBasicTreeData;

  constructor(tree: ITree, parent: BasicCompositeTreeNode | undefined, data: IBasicTreeData, id?: number) {
    super(tree, parent, undefined, {}, { disableCache: true });
    if (data.expanded) {
      this._whenReady = this.setExpanded();
    }
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    this.name = String(this._uid);
    this._displayName = data.label;
    this._raw = data;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get whenReady() {
    return this._whenReady;
  }

  get displayName() {
    return this._displayName;
  }

  get icon() {
    return this.raw.icon;
  }

  get iconClassName() {
    return this.raw.iconClassName;
  }

  get description() {
    return this.raw.description;
  }

  get raw() {
    return this._raw;
  }

  get expandable() {
    return !!this._raw.expandable;
  }
}

export class BasicTreeNode extends TreeNode {
  private _displayName: string;
  private _raw: IBasicTreeData;

  constructor(tree: ITree, parent: BasicCompositeTreeNode | undefined, data: IBasicTreeData, id?: number) {
    super(tree, parent, undefined, {}, { disableCache: true });
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    this.name = String(this._uid);
    this._displayName = data.label;
    this._raw = data;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get displayName() {
    return this._displayName;
  }

  get description() {
    return this.raw.description;
  }

  get icon() {
    return this.raw.icon;
  }

  get iconClassName() {
    return this.raw.iconClassName;
  }

  get raw() {
    return this._raw;
  }
}
