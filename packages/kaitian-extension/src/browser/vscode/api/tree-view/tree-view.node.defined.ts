import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';
import { TreeViewDataProvider } from '../main.thread.treeview';
import { ICommand } from '../../../../common/vscode/models';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next';
import { IAccessibilityInformation } from '@ali/ide-core-common';
import { ITreeItemLabel, TreeViewItem } from '../../../../common/vscode';

export class ExtensionTreeRoot extends CompositeTreeNode {

  public static is(node: any): node is ExtensionTreeRoot {
    return !!node && 'children' in node && !node.parent;
  }

  private _displayName: string;

  constructor(
    treeViewDataProvider: TreeViewDataProvider,
    public treeViewId: string = '',
  ) {
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
  private _resolved?: TreeViewItem;

  private _whenReady: Promise<void>;

  constructor(
    tree: TreeViewDataProvider,
    parent: ExtensionCompositeTreeNode | undefined,
    label: string | ITreeItemLabel,
    public description: string = '',
    public icon: string = '',
    tooltip: string = '',
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

  get command() {
    if (!this._resolved) {
      this.resolveTreeItem();
    }
    return this._command;
  }

  get tooltip() {
    if (!this._resolved) {
      this.resolveTreeItem();
    }
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
    this._resolved = await (this._tree as TreeViewDataProvider).resolveTreeItem((this._tree as TreeViewDataProvider).treeViewId, this.treeItemId);
    this._tooltip = this._resolved?.tooltip;
    this._command = this._resolved?.command;
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionTreeNode extends TreeNode {
  private _displayName: string;
  private _hightlights?: [number, number][];
  private _strikethrough?: boolean;

  constructor(
    tree: TreeViewDataProvider,
    parent: ExtensionCompositeTreeNode | undefined,
    label: string | ITreeItemLabel,
    public description: string = '',
    public icon: string = '',
    public tooltip: string = '',
    public command: ICommand | undefined,
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
}
