import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';
import { TreeViewDataProvider } from '../main.thread.treeview';
import { ICommand } from '../../../../common/vscode/ext-types';

export class ExtensionTreeRoot extends CompositeTreeNode {

  public static is(node: any): node is ExtensionTreeRoot {
    return !!node && 'children' in node && !node.parent;
  }

  private _displayName: string;

  constructor(
    private treeViewDataProvider: TreeViewDataProvider,
    public treeViewId: string = '',
    id?: number,
  ) {
    super(treeViewDataProvider as ITree, undefined);
  }

  get treeItemId() {
    return `Root_${this.treeViewId}`;
  }

  get expanded() {
    return true;
  }

  get displayName() {
    return this._displayName || this.name;
  }

  getTreeNodeByTreeItemId(treeItemId: string) {
    return this.treeViewDataProvider.getNodeByTreeItemId(treeItemId);
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionCompositeTreeNode extends CompositeTreeNode {

  private _displayName: string;

  constructor(
    tree: TreeViewDataProvider,
    public readonly parent: ExtensionCompositeTreeNode | undefined,
    public name: string = '',
    public description: string = '',
    public icon: string = '',
    public tooltip: string = '',
    public command: ICommand | undefined,
    public contextValue: string = '',
    public treeItemId: string = '',
    expanded?: boolean,
  ) {
    super(tree as ITree, parent);
    if (expanded) {
      this.setExpanded();
    }
  }

  get displayName() {
    return this._displayName || this.name;
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionTreeNode extends TreeNode {
  private _displayName: string;

  constructor(
    tree: TreeViewDataProvider,
    public readonly parent: ExtensionCompositeTreeNode | undefined,
    public name: string = '',
    public description: string = '',
    public icon: string = '',
    public tooltip: string = '',
    public command: ICommand | undefined,
    public contextValue: string = '',
    public treeItemId: string = '',
  ) {
    super(tree as ITree, parent);
  }

  get displayName() {
    return this._displayName || this.name;
  }

  dispose() {
    super.dispose();
  }
}
