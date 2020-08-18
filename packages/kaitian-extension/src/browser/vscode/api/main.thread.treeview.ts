import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optinal } from '@ali/common-di';
import { TreeViewItem, TreeViewBaseOptions } from '../../../common/vscode';
import { TreeItemCollapsibleState } from '../../../common/vscode/ext-types';
import { IMainThreadTreeView, IExtHostTreeView, ExtHostAPIIdentifier } from '../../../common/vscode';
import { MenuPath, Emitter, DisposableStore, toDisposable, isUndefined } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { ExtensionTabBarTreeView } from '../../components';
import { IIconService, IconType } from '@ali/ide-theme';
import { ExtensionTreeViewModel } from './tree-view/tree-view.model.service';
import { ExtensionCompositeTreeNode, ExtensionTreeRoot, ExtensionTreeNode } from './tree-view/tree-view.node.defined';
import { Tree } from '@ali/ide-components';

export const VIEW_ITEM_CONTEXT_MENU: MenuPath = ['view-item-context-menu'];
export const VIEW_ITEM_INLINE_MNUE: MenuPath = ['view-item-inline-menu'];

@Injectable({multiple: true})
export class MainThreadTreeView implements IMainThreadTreeView {
  private readonly proxy: IExtHostTreeView;

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  // readonly dataProviders: Map<string, TreeViewDataProvider> = new Map<string, TreeViewDataProvider>();
  readonly treeModels: Map<string, ExtensionTreeViewModel> = new Map<string, ExtensionTreeViewModel>();

  private disposableCollection: Map<string, DisposableStore> = new Map();
  private disposable: DisposableStore = new DisposableStore();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTreeView);
    this.disposable.add(toDisposable(() => this.treeModels.clear()));
  }

  dispose() {
    this.disposable.dispose();
  }

  createTreeModel(treeViewId: string, dataProvider: TreeViewDataProvider): ExtensionTreeViewModel {
    return ExtensionTreeViewModel.createModel(this.injector, dataProvider, treeViewId);
  }

  $registerTreeDataProvider(treeViewId: string, options: TreeViewBaseOptions): void {
    if (!this.treeModels.has(treeViewId)) {
      const disposable = new DisposableStore();
      const dataProvider = new TreeViewDataProvider(treeViewId, this.proxy, this.iconService);
      const model = this.createTreeModel(treeViewId, dataProvider);
      this.treeModels.set(treeViewId, model);
      disposable.add(toDisposable(() => this.treeModels.delete(treeViewId)));
      this.mainLayoutService.replaceViewComponent({
        id: treeViewId,
        component: ExtensionTabBarTreeView,
      }, {
        model,
        options,
      });
      const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
      if (handler) {
        handler.onActivate(() => {
          dataProvider.setVisible(treeViewId, true);
        });
        handler.onInActivate(() => {
          dataProvider.setVisible(treeViewId, false);
        });
        disposable.add(toDisposable(() => handler.disposeView(treeViewId)));
      }
      this.disposableCollection.set(treeViewId, disposable);
    }
  }

  $unregisterTreeDataProvider(treeViewId: string) {
    const disposable = this.disposableCollection.get(treeViewId);
    if (disposable) {
      disposable.dispose();
    }
  }

  $refresh(treeViewId: string, itemsToRefresh?: TreeViewItem) {
    const treeModel = this.treeModels.get(treeViewId);
    if (treeModel) {
      treeModel.refresh(itemsToRefresh);
    }
  }

  async $reveal(treeViewId: string, treeItemId: string) {
    const treeModel = this.treeModels.get(treeViewId);
    if (treeModel) {
      treeModel.reveal(treeItemId);
    }
  }
}

export class TreeViewDataProvider extends Tree {

  private onTreeDataChangedEmitter = new Emitter<any>();
  private onRevealChangedEmitter = new Emitter<any>();

  private treeItemId2TreeNode: Map<string, ExtensionTreeNode | ExtensionCompositeTreeNode | ExtensionTreeRoot> = new Map();

  constructor(
    public readonly treeViewId: string,
    private readonly proxy: IExtHostTreeView,
    private readonly iconService: IIconService,
  ) {
    super();
  }

  get onTreeDataChanged() {
    return this.onTreeDataChangedEmitter.event;
  }

  get onRevealChanged() {
    return this.onRevealChangedEmitter.event;
  }

  get root() {
    return this._root;
  }

  async createFoldNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionCompositeTreeNode> {
    const expanded = TreeItemCollapsibleState.Expanded === item.collapsibleState;
    const icon = await this.toIconClass(item);

    return new ExtensionCompositeTreeNode(
      this,
      parent,
      item.label,
      item.description,
      icon,
      item.tooltip,
      item.command,
      item.contextValue || '',
      item.id,
      expanded,
    );
  }

  async createNormalNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionTreeNode> {
    const icon = await this.toIconClass(item);
    return new ExtensionTreeNode(
      this,
      parent,
      item.label,
      item.description,
      icon,
      item.tooltip,
      item.command,
      item.contextValue || '',
      item.id,
    );
  }

  async toIconClass(item: TreeViewItem): Promise<string | undefined> {
    if (item.iconUrl || item.icon) {
      return this.iconService.fromIcon('', item.iconUrl || item.icon, IconType.Background);
    } else {
      return '';
    }
  }

  /**
   * 创建节点
   *
   * @param item tree view item from the ext
   */
  async createTreeNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionCompositeTreeNode | ExtensionTreeNode> {
    if (!isUndefined(item.collapsibleState) && item.collapsibleState !== TreeItemCollapsibleState.None) {
      return await this.createFoldNode(item, parent);
    }
    return await this.createNormalNode(item, parent);
  }

  async resolveChildren(parent?: ExtensionCompositeTreeNode): Promise<(ExtensionCompositeTreeNode | ExtensionTreeRoot | ExtensionTreeNode)[]> {
    let nodes: (ExtensionCompositeTreeNode | ExtensionTreeRoot | ExtensionTreeNode)[] = [];
    if (parent) {
      let children: TreeViewItem[] | undefined;
      if (ExtensionTreeRoot.is(parent)) {
        children = await this.proxy.$getChildren(this.treeViewId);
      } else {
        children = await this.proxy.$getChildren(this.treeViewId, parent.treeItemId);
      }
      if (children && Array.isArray(children)) {
        for (const child of children) {
          const node = await this.createTreeNode(child, parent);
          nodes.push(node);
        }
      }
    } else {
      nodes = [new ExtensionTreeRoot(this as any, this.treeViewId)];
    }

    return nodes;
  }

  getNodeByTreeItemId(treeItemId: string) {
    return this.treeItemId2TreeNode.get(treeItemId);
  }

  cacheNodes(nodes: (ExtensionCompositeTreeNode | ExtensionTreeRoot | ExtensionTreeNode)[]) {
    nodes.forEach((node) => {
      this.treeItemId2TreeNode.set(node.treeItemId, node);
    });
  }

  async refresh(itemsToRefresh?: TreeViewItem) {
    await this.onTreeDataChangedEmitter.fire(itemsToRefresh);
  }

  async reveal(viewItemId?: any) {
    await this.onRevealChangedEmitter.fire(viewItemId);
  }

  async setSelection(treeViewId: string, id: string[]) {
    this.proxy.$setSelection(treeViewId, id);
  }

  async setExpanded(treeViewId: string, id: any, expanded: boolean) {
    this.proxy.$setExpanded(treeViewId, id, expanded);
  }

  async setVisible(treeViewId: string, visible: boolean) {
    this.proxy.$setVisible(treeViewId, visible);
  }

  dispose() {
    super.dispose();
    this.treeItemId2TreeNode.clear();
  }
}
