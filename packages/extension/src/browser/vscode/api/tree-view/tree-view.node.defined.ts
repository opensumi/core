import { TreeNode, CompositeTreeNode, ITree } from '@opensumi/ide-components';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next';
import { IAccessibilityInformation } from '@opensumi/ide-core-common';

import { ITreeItemLabel } from '../../../../common/vscode';
import { ICommand } from '../../../../common/vscode/models';
import { TreeViewDataProvider } from '../main.thread.treeview';

export class ExtensionTreeRoot extends CompositeTreeNode {
  public static is(node: any): node is ExtensionTreeRoot {
    return !!node && 'children' in node && !node.parent;
  }

  private _displayName: string;

  constructor(treeViewDataProvider: TreeViewDataProvider, public treeViewId: string = '') {
    super(treeViewDataProvider as ITree, undefined);
  }

  get treeItemId() {
    return `TreeViewRoot_${this.treeViewId}`;
  }

  get name() {
    return `TreeViewRoot_${this.id}`;
  }

  get expanded() {
    return true;
  }

  get displayName() {
    return this._displayName || this.name;
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionCompositeTreeNode extends CompositeTreeNode {
  private _displayName: string;
  private _hightlights?: [number, number][];
  private _strikethrough?: boolean;
  private _command?: ICommand;
  private _tooltip?: string;
  private _resolved = false;

  private _whenReady: Promise<void>;

  constructor(
    tree: TreeViewDataProvider,
    parent: ExtensionCompositeTreeNode | undefined,
    label: string | ITreeItemLabel,
    public description: string = '',
    public icon: string = '',
    tooltip = '',
    command: ICommand | undefined,
    public contextValue: string = '',
    public treeItemId: string = '',
    public actions: MenuNode[],
    private _accessibilityInformation?: IAccessibilityInformation,
    expanded?: boolean,
    id?: number,
  ) {
    super(tree, parent, undefined, {}, { disableCache: true });
    if (expanded) {
      this._whenReady = this.setExpanded();
    }
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    // displayName 作为展示用的字段
    this.name = String(this._uid);
    this._command = command;
    this._tooltip = tooltip;
    if (typeof label === 'string') {
      this._displayName = label;
    } else if (typeof label === 'object') {
      this._displayName = label.label;
      this._hightlights = label.highlights;
      this._strikethrough = label.strikethrough;
    }
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get resolved() {
    return this._resolved;
  }

  get command() {
    return this._command;
  }

  get tooltip() {
    return this._tooltip;
  }

  get displayName() {
    return this._displayName;
  }

  get whenReady() {
    return this._whenReady;
  }

  get accessibilityInformation() {
    return {
      role: this._accessibilityInformation?.role || 'treeitem',
      label: this._accessibilityInformation?.label || this.displayName,
    };
  }

  get strikethrough() {
    return this._strikethrough;
  }

  get highlights() {
    return this._hightlights;
  }

  async resolveTreeItem() {
    const resolved = await (this._tree as TreeViewDataProvider).resolveTreeItem(
      (this._tree as TreeViewDataProvider).treeViewId,
      this.treeItemId,
    );
    if (resolved) {
      this._tooltip = resolved.tooltip;
      this._command = resolved.command;
    }
    this._resolved = true;
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionTreeNode extends TreeNode {
  private _displayName: string;
  private _hightlights?: [number, number][];
  private _strikethrough?: boolean;

  private _resolved = false;

  constructor(
    tree: TreeViewDataProvider,
    parent: ExtensionCompositeTreeNode | undefined,
    label: string | ITreeItemLabel,
    public description: string = '',
    public icon: string = '',
    private _tooltip: string | undefined,
    private _command: ICommand | undefined,
    public contextValue: string = '',
    public treeItemId: string = '',
    public actions: MenuNode[],
    private _accessibilityInformation?: IAccessibilityInformation,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, {}, { disableCache: true });
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    // displayName 作为展示用的字段
    this.name = String(this._uid);
    if (typeof label === 'string') {
      this._displayName = label;
    } else if (typeof label === 'object') {
      this._displayName = label.label;
      this._hightlights = label.highlights;
      this._strikethrough = label.strikethrough;
    }
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get resolved() {
    return this._resolved;
  }

  get command() {
    return this._command;
  }

  get tooltip() {
    return this._tooltip;
  }

  get displayName() {
    return this._displayName;
  }

  get accessibilityInformation() {
    return {
      role: this._accessibilityInformation?.role || 'treeitem',
      label: this._accessibilityInformation?.label || this.displayName,
    };
  }

  get strikethrough() {
    return this._strikethrough;
  }

  get highlights() {
    return this._hightlights;
  }

  async resolveTreeItem() {
    const resolved = await (this._tree as TreeViewDataProvider).resolveTreeItem(
      (this._tree as TreeViewDataProvider).treeViewId,
      this.treeItemId,
    );
    if (resolved) {
      this._tooltip = resolved.tooltip;
      this._command = resolved.command;
    }
    this._resolved = true;
  }
}
