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
    return `BasicTreeRoot_${this.id}`;
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
  private _raw: IBasicTreeData;

  constructor(tree: ITree, parent: BasicCompositeTreeNode | undefined, data: IBasicTreeData, id?: number) {
    super(tree, parent, undefined, {});
    this.isExpanded = data.expanded || false;
    this.id = id || this.id;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    this.name = String(this.id);
    this._displayName = data.label;
    this._raw = data;
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
    super(tree, parent, undefined, {});
    this.id = id || this.id;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    this.name = String(this.id);
    this._displayName = data.label;
    this._raw = data;
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
