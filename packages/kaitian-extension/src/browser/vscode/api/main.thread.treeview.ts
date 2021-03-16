import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optinal } from '@ali/common-di';
import { TreeViewItem, TreeViewBaseOptions, ITreeViewRevealOptions } from '../../../common/vscode';
import { TreeItemCollapsibleState } from '../../../common/vscode/ext-types';
import { IMainThreadTreeView, IExtHostTreeView, ExtHostAPIIdentifier } from '../../../common/vscode';
import { Emitter, DisposableStore, toDisposable, isUndefined, CommandRegistry, localize, getIcon, getExternalIcon, LabelService, URI, IContextKeyService } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { ExtensionTabBarTreeView } from '../../components';
import { IIconService, IconType, IThemeService } from '@ali/ide-theme';
import { ExtensionTreeViewModel } from './tree-view/tree-view.model.service';
import { ExtensionCompositeTreeNode, ExtensionTreeRoot, ExtensionTreeNode } from './tree-view/tree-view.node.defined';
import { Tree, ITreeNodeOrCompositeTreeNode } from '@ali/ide-components';
import { AbstractMenuService, generateCtxMenu, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

@Injectable({multiple: true})
export class MainThreadTreeView implements IMainThreadTreeView {
  static TREE_VIEW_COLLAPSE_ALL_COMMAND_ID = 'TREE_VIEW_COLLAPSE_ALL';

  private readonly proxy: IExtHostTreeView;

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  // readonly dataProviders: Map<string, TreeViewDataProvider> = new Map<string, TreeViewDataProvider>();
  readonly treeModels: Map<string, ExtensionTreeViewModel> = new Map<string, ExtensionTreeViewModel>();

  private disposableCollection: Map<string, DisposableStore> = new Map();
  private disposable: DisposableStore = new DisposableStore();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTreeView);
    this.disposable.add(toDisposable(() => this.treeModels.clear()));
    this._registerInternalCommands();
  }

  dispose() {
    this.disposable.dispose();
  }

  createTreeModel(treeViewId: string, dataProvider: TreeViewDataProvider, options: TreeViewBaseOptions): ExtensionTreeViewModel {
    return ExtensionTreeViewModel.createModel(this.injector, dataProvider, treeViewId, options || {});
  }

  $registerTreeDataProvider(treeViewId: string, options: TreeViewBaseOptions): void {
    if (this.treeModels.has(treeViewId)) {
      return;
    }
    const disposable = new DisposableStore();
    const dataProvider = new TreeViewDataProvider(treeViewId, this.proxy, this.iconService, this.themeService, this.labelService, this.contextKeyService, this.menuService);
    const model = this.createTreeModel(treeViewId, dataProvider, options);
    this.treeModels.set(treeViewId, model);
    disposable.add(toDisposable(() => this.treeModels.delete(treeViewId)));
    this.mainLayoutService.replaceViewComponent({
      id: treeViewId,
      component: ExtensionTabBarTreeView,
    }, {
      model,
      treeViewId,
    });

    // const treeViewCollapseAllCommand = getTreeViewCollapseAllCommand(treeViewId);
    if (options?.showCollapseAll) {
      disposable.add(
        this.menuRegistry.registerMenuItem(MenuId.ViewTitle, {
          command: {
            id: MainThreadTreeView.TREE_VIEW_COLLAPSE_ALL_COMMAND_ID,
            label: localize('treeview.command.action.collapse'),
          },
          extraTailArgs: [treeViewId],
          iconClass: getIcon('collapse-all'),
          when: `view == ${treeViewId}`,
          group: 'navigation',
          order: 10000, // keep the last position
        }),
      );
    }
    disposable.add(model.onDidSelectedNodeChange((treeItemIds: string[]) => {
      dataProvider.setSelection(treeViewId, treeItemIds);
    }));
    disposable.add(model.onDidChangeExpansionState((state: {treeItemId: string, expanded: boolean}) => {
      const { treeItemId, expanded } = state;
      dataProvider.setExpanded(treeViewId, treeItemId, expanded);
    }));
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      disposable.add(handler.onActivate(() => {
        dataProvider.setVisible(treeViewId, true);
      }));
      disposable.add(handler.onInActivate(() => {
        dataProvider.setVisible(treeViewId, false);
      }));
      disposable.add(disposable.add(toDisposable(() => handler.disposeView(treeViewId))));
    }
    this.disposableCollection.set(treeViewId, disposable);
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

  async $reveal(treeViewId: string, treeItemId: string, options?: ITreeViewRevealOptions) {
    this.mainLayoutService.revealView(treeViewId);
    const treeModel = this.treeModels.get(treeViewId);
    if (treeModel) {
      treeModel.reveal(treeItemId, options);
    }
  }

  private _registerInternalCommands() {
    this.disposable.add(
      this.commandRegistry.registerCommand({
        id: MainThreadTreeView.TREE_VIEW_COLLAPSE_ALL_COMMAND_ID,
      }, {
        execute: (treeViewId: string) => {
          const treeModel = this.treeModels.get(treeViewId);
          if (treeModel) {
            treeModel.collapseAll();
          }
        },
      }),
    );
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
    private readonly themeService: IThemeService,
    private readonly labelService: LabelService,
    private readonly contextKeyService: IContextKeyService,
    private readonly menuService: AbstractMenuService,
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

  public getTreeNodeIdByTreeItemId(treeItemId: string) {
    return this.treeItemId2TreeNode.get(treeItemId)?.id;
  }

  async createFoldNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionCompositeTreeNode> {
    const expanded = TreeItemCollapsibleState.Expanded === item.collapsibleState;
    const icon = await this.toIconClass(item);
    const actions = item.contextValue ? this.getInlineMenuNodes(item.contextValue) : [];
    const node = new ExtensionCompositeTreeNode(
      this,
      parent,
      item.label,
      item.description,
      icon,
      item.tooltip,
      item.command,
      item.contextValue || '',
      item.id,
      actions,
      expanded,
      // 传入缓存的节点id，保障节点在初始化之后path及id一直保持一致
      this.treeItemId2TreeNode.get(item.id)?.id,
    );
    return node;
  }

  async createNormalNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionTreeNode> {
    const icon = await this.toIconClass(item);
    const actions = item.contextValue ? this.getInlineMenuNodes(item.contextValue) : [];
    const node = new ExtensionTreeNode(
      this,
      parent,
      item.label,
      item.description,
      icon,
      item.tooltip,
      item.command,
      item.contextValue || '',
      item.id,
      actions,
      // 传入缓存的节点id，保障节点在初始化之后path及id一直保持一致
      this.treeItemId2TreeNode.get(item.id)?.id,
    );
    return node;
  }

  async toIconClass(item: TreeViewItem): Promise<string | undefined> {
    if (item.iconUrl || item.icon) {
      return this.iconService.fromIcon('', item.iconUrl || item.icon, IconType.Background);
    } else if (item.themeIcon) {
      let themeIconClass = getExternalIcon(item.themeIcon.id);
      if (item.resourceUri) {
        if (item.themeIcon.id === 'file') {
          themeIconClass = this.labelService.getIcon(URI.from(item.resourceUri));
        } else if (item.themeIcon.id === 'folder') {
          themeIconClass = this.labelService.getIcon(URI.from(item.resourceUri), {
            isDirectory: true,
          });
        }
      }
      const themeColorClass = this.themeService.getColorClassNameByColorToken(item.themeIcon.color);
      return `${themeIconClass} ${themeColorClass ?? '' }`;
    } else {
      return '';
    }
  }

  private getInlineMenuNodes(viewItemValue: string) {
    const viewContextKey = this.contextKeyService.createScoped();

    viewContextKey.createKey('view', this.treeViewId);
    viewContextKey.createKey('viewItem', viewItemValue);

    // viewItem
    const menus = this.menuService.createMenu(MenuId.ViewItemContext, viewContextKey);
    const result = generateCtxMenu({ menus, separator: 'inline' });
    menus.dispose();
    viewContextKey.dispose();

    return result[0];
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
    this.cacheNodes(nodes);
    return nodes;
  }

  // 按照默认次序排序
  sortComparator(a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) {
    if (!a) {
      return 1;
    }
    if (!b) {
      return -1;
    }
    return 0;
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
