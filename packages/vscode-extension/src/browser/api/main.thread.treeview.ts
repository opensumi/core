import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { TreeItemCollapsibleState } from '../../common/ext-types';
import { IMainThreadTreeView, IExtHostTreeView, ExtHostAPIIdentifier, IExtHostMessage, TreeViewItem, TreeViewNode, CompositeTreeViewNode } from '../../common';
import { TreeNode } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { ExtensionTabbarTreeView } from '../components';

@Injectable()
export class MainThreadTreeView implements IMainThreadTreeView {
  private readonly proxy: IExtHostTreeView;
  private readonly dataProviders: Map<string, TreeViewDataProviderMain> = new Map<string, TreeViewDataProviderMain>();

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTreeView);
  }

  $registerTreeDataProvider(treeViewId: string): void {
    const dataProvider = new TreeViewDataProviderMain(treeViewId, this.proxy);
    this.dataProviders.set(treeViewId, dataProvider);

    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      handler.registerView({
        id: treeViewId,
        name: treeViewId,
        component: ExtensionTabbarTreeView,
      }, {dataProvider});
    }

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
    const expanded = TreeItemCollapsibleState.Expanded === item.collapsibleState;
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
    if (item.collapsibleState !== TreeItemCollapsibleState.None) {
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
