import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { TreeItemCollapsibleState } from '../../common/ext-types';
import { IMainThreadTreeView, IExtHostTreeView, ExtHostAPIIdentifier, IExtHostMessage, TreeViewItem, TreeViewNode, CompositeTreeViewNode } from '../../common';
import { TreeNode, URI, Domain } from '@ali/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { ViewRegistry } from '../view-registry';
import { ExtensionTabbarTreeView } from '../components';
import { ViewUiStateManager } from '@ali/ide-activity-panel/lib/browser/view-container-state';

@Injectable()
export class MainThreadTreeView implements IMainThreadTreeView {
  private readonly proxy: IExtHostTreeView;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(StaticResourceService)
  staticResourceService: StaticResourceService;

  @Autowired()
  viewStateManager: ViewUiStateManager;

  readonly dataProviders: Map<string, TreeViewDataProviderMain> = new Map<string, TreeViewDataProviderMain>();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTreeView);
  }

  $registerTreeDataProvider(treeViewId: string): void {
    console.log(treeViewId, 'treeviewid');
    const dataProvider = new TreeViewDataProviderMain(treeViewId, this.proxy, this.staticResourceService);
    this.dataProviders.set(treeViewId, dataProvider);
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      const {width, height} = this.viewStateManager.viewStateMap.get(treeViewId)!;
      handler.registerView({
        id: treeViewId,
        name: treeViewId,
        component: ExtensionTabbarTreeView,
      }, {
        dataProvider: this.dataProviders.get(treeViewId),
        width,
        height,
        rendered: this.viewStateManager.rendered,
      });
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
    private staticResourceService: StaticResourceService,
  ) { }

  async createFolderNode(item: TreeViewItem): Promise<CompositeTreeViewNode> {
    const expanded = TreeItemCollapsibleState.Expanded === item.collapsibleState;
    const icon = await this.toIconClass(item);
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

  async createFileNode(item: TreeViewItem): Promise<TreeViewNode> {
    const icon = await this.toIconClass(item);
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

  async toIconClass(item: TreeViewItem): Promise<string | undefined> {
    if (item.iconUrl && typeof item.iconUrl !== 'string' && item.iconUrl.dark) {
      const randomIconClass = `icon-${Math.random().toString(36).slice(-8)}`;
      const iconUrl = (await this.staticResourceService.resolveStaticResource(URI.file(item.iconUrl.dark))).toString();
      const cssRule = `.${randomIconClass} {background-image: url(${iconUrl});background-size: 16px;background-position: 0;background-repeat: no-repeat;padding-right: 22px;width: 0;height: 22px;-webkit-font-smoothing: antialiased;box-sizing: border-box;}`;
      let iconStyleNode = document.getElementById('plugin-icons');
      if (!iconStyleNode) {
        iconStyleNode = document.createElement('style');
        iconStyleNode.id = 'plugin-icons';
        document.getElementsByTagName('head')[0].appendChild(iconStyleNode);
      }
      iconStyleNode.append(cssRule);
      return randomIconClass;
    }
  }

  /**
   * 创建节点
   *
   * @param item tree view item from the ext
   */
  async createTreeNode(item: TreeViewItem): Promise<TreeNode> {
    if (item.collapsibleState !== TreeItemCollapsibleState.None) {
      return await this.createFolderNode(item);
    }
    return await this.createFileNode(item);
  }

  async resolveChildren(itemId?: string): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];
    const children = await this.proxy.$getChildren(this.treeViewId, itemId);
    if (children) {
      for (const child of children) {
        const node = await this.createTreeNode(child);
        nodes.push(node);
      }
    }
    return nodes;
  }

}
