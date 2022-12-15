import { CompositeTreeNode, TreeNode } from '../tree';
import { ITree } from '../types';

import { IBasicTreeData } from './types';

interface IBasicTreeRootOptions {
  treeName?: string;
}

export class BasicTreeRoot extends CompositeTreeNode {
  private _raw: IBasicTreeData;
  constructor(
    tree: ITree,
    parent: BasicCompositeTreeNode | undefined,
    data: IBasicTreeData,
    basicTreeRootOptions = {} as IBasicTreeRootOptions,
  ) {
    super(tree, parent, undefined, {
      treeName: basicTreeRootOptions.treeName,
    });
    this._raw = data;
  }

  get name() {
    return this.getMetadata('treeName') ?? `BasicTreeRoot_${this.id}`;
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
    super(tree, parent, undefined, {
      name: data.label,
    });
    this.isExpanded = data.expanded || false;
    this.id = id || this.id;
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
    super(tree, parent, undefined, {
      name: data.label,
    });
    this.id = id || this.id;
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
