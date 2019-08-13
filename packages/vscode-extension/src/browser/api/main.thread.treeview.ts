import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Optinal } from '@ali/common-di';
import { TreeViewItem, TreeViewNode, CompositeTreeViewNode, TreeViewItemCollapsibleState } from '../../common/ext-types';
import { IMainThreadTreeView, IExtHostTreeView, ExtHostAPIIdentifier, IExtHostMessage } from '../../common';
import { TreeNode } from '@ali/ide-core-browser';
@Injectable()
export class MainThreadTreeView implements IMainThreadTreeView {
  private readonly proxy: IExtHostTreeView;
  private readonly messageService: IExtHostMessage;
  private readonly dataProviders: Map<string, TreeViewDataProviderMain> = new Map<string, TreeViewDataProviderMain>();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol, messageService: IExtHostMessage) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTreeView);
    this.messageService = messageService;
  }

  $registerTreeDataProvider(treeViewId: string): void {
    const dataProvider = new TreeViewDataProviderMain(treeViewId, this.proxy);
    this.dataProviders.set(treeViewId, dataProvider);

  }

  $refresh(treeViewId: string) {

  }

  async $reveal(treeViewId: string, treeItemId: string) {

  }

}

export class TreeViewDataProviderMain {

  constructor(
    private treeViewId: string,
    private proxy: IExtHostTreeView,
  ) { }

  createFolderNode(item: TreeViewItem): CompositeTreeViewNode {
    const expanded = TreeViewItemCollapsibleState.Expanded === item.collapsibleState;
    const icon = this.toIconClass(item);
    return {
      id: item.id,
      parent: undefined,
      name: item.label,
      icon,
      description: item.tooltip,
      visible: true,
      selected: false,
      expanded,
      children: [],
      contextValue: item.contextValue,
      depth: 0,
    };
  }

  createFileNode(item: TreeViewItem): TreeViewNode {
    const icon = this.toIconClass(item);
    return {
      id: item.id,
      name: item.label,
      icon,
      description: item.tooltip,
      parent: undefined,
      visible: true,
      selected: false,
      contextValue: item.contextValue,
      command: item.command,
      depth: 0,
    };
  }

  protected toIconClass(item: TreeViewItem): string | undefined {
    return undefined;
  }

  /**
   * 创建节点
   *
   * @param item tree view item from the ext
   */
  createTreeNode(item: TreeViewItem): TreeNode {
    if (item.collapsibleState !== TreeViewItemCollapsibleState.None) {
      return this.createFolderNode(item);
    }
    return this.createFileNode(item);
  }

  async resolveChildren(itemId: string): Promise<TreeNode[]> {
    const children = await this.proxy.$getChildren(this.treeViewId, itemId);

    if (children) {
      return children.map((value) => this.createTreeNode(value));
    }

    return [];
  }

}
