import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import { CompositeTreeNode, ITreeNodeOrCompositeTreeNode, Tree } from '@opensumi/ide-components';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  BinaryBuffer,
  CancellationToken,
  CancellationTokenSource,
  CommandRegistry,
  Disposable,
  DisposableStore,
  Emitter,
  Event,
  IContextKeyService,
  LabelService,
  URI,
  WithEventBus,
  getExternalIcon,
  getIcon,
  isString,
  isUndefined,
  localize,
  toDisposable,
} from '@opensumi/ide-core-browser';
import {
  AbstractMenuService,
  IMenuRegistry,
  MenuId,
  MenuNode,
  generateCtxMenu,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMainLayoutService, ViewCollapseChangedEvent } from '@opensumi/ide-main-layout';
import { IIconService, IThemeService, IconType } from '@opensumi/ide-theme';

import { ExtensionHostType } from '../../../common';
import {
  ExtHostAPIIdentifier,
  IExtHostTreeView,
  IMainThreadTreeView,
  ITreeViewRevealOptions,
  IconUrl,
  TreeViewBaseOptions,
  TreeViewItem,
  ViewBadge,
} from '../../../common/vscode';
import { DataTransfer } from '../../../common/vscode/converter';
import { VSDataTransfer, createStringDataTransferItem } from '../../../common/vscode/data-transfer';
import { DataTransferCache } from '../../../common/vscode/data-transfer-cache';
import { TreeItemCollapsibleState } from '../../../common/vscode/ext-types';
import { ExtensionTabBarTreeView } from '../../components';

import { ExtensionTreeViewModel, ITreeViewDragAndDropController } from './tree-view/tree-view.model.service';
import { ExtensionCompositeTreeNode, ExtensionTreeNode, ExtensionTreeRoot } from './tree-view/tree-view.node.defined';

@Injectable({ multiple: true })
export class MainThreadTreeView extends WithEventBus implements IMainThreadTreeView {
  static TREE_VIEW_COLLAPSE_ALL_COMMAND_ID = 'TREE_VIEW_COLLAPSE_ALL';
  static TREE_VIEW_COLLAPSE_ALL_COMMAND_ID_WORKER = 'TREE_VIEW_COLLAPSE_ALL_WORKER';

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

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(IFileServiceClient)
  protected fileServiceClient: IFileServiceClient;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private userhome?: URI;

  readonly treeModels: Map<string, ExtensionTreeViewModel> = new Map<string, ExtensionTreeViewModel>();
  readonly dndControllers: Map<string, TreeViewDragAndDropController> = new Map<
    string,
    TreeViewDragAndDropController
  >();

  private disposableCollection: Map<string, DisposableStore> = new Map();
  private disposable: DisposableStore = new DisposableStore();

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol, private extensionHostType: ExtensionHostType) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTreeView);
    this.disposable.add(toDisposable(() => this.treeModels.clear()));
    this.disposable.add(toDisposable(() => this.dndControllers.clear()));
    this._registerInternalCommands();
    this.fileServiceClient.getCurrentUserHome().then((home) => {
      if (home) {
        this.userhome = new URI(home.uri);
      }
    });

    this.addDispose(
      this.eventBus.on(ViewCollapseChangedEvent, (e) => {
        if (e.payload.viewId && this.treeModels.has(e.payload.viewId) && !e.payload.collapsed) {
          const treeModel = this.treeModels.get(e.payload.viewId);
          if (treeModel) {
            this.progressService.withProgress({ location: e.payload.viewId }, () => treeModel.refresh());
          }
        }
      }),
    );
  }

  dispose() {
    this.disposable.dispose();

    this.disposableCollection.forEach((item) => {
      item.dispose();
    });

    this.disposableCollection.clear();
  }

  createTreeModel(
    treeViewId: string,
    dataProvider: TreeViewDataProvider,
    dndController: TreeViewDragAndDropController,
    options: TreeViewBaseOptions,
  ): ExtensionTreeViewModel {
    return ExtensionTreeViewModel.createModel(this.injector, dataProvider, dndController, treeViewId, options || {});
  }

  async $registerTreeDataProvider(treeViewId: string, options: TreeViewBaseOptions) {
    if (this.treeModels.has(treeViewId)) {
      return;
    }
    const disposable = new DisposableStore();
    const dataProvider = new TreeViewDataProvider(
      treeViewId,
      this.proxy,
      this.iconService,
      this.themeService,
      this.labelService,
      this.contextKeyService,
      this.menuService,
      this.userhome,
    );
    const dndController = new TreeViewDragAndDropController(
      treeViewId,
      options.dropMimeTypes as string[],
      options.dragMimeTypes as string[],
      options.hasHandleDrag,
      this.proxy,
    );
    const model = this.createTreeModel(treeViewId, dataProvider, dndController, options);
    this.treeModels.set(treeViewId, model);
    this.dndControllers.set(treeViewId, dndController);
    disposable.add(toDisposable(() => this.treeModels.delete(treeViewId)));
    this.mainLayoutService.replaceViewComponent(
      {
        id: treeViewId,
        component: ExtensionTabBarTreeView,
      },
      {
        model,
        dataProvider,
        treeViewId,
      },
    );

    // const treeViewCollapseAllCommand = getTreeViewCollapseAllCommand(treeViewId);
    if (options?.showCollapseAll) {
      disposable.add(
        this.menuRegistry.registerMenuItem(MenuId.ViewTitle, {
          command: {
            id:
              this.extensionHostType === 'worker'
                ? MainThreadTreeView.TREE_VIEW_COLLAPSE_ALL_COMMAND_ID_WORKER
                : MainThreadTreeView.TREE_VIEW_COLLAPSE_ALL_COMMAND_ID,
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
    disposable.add(
      model.onDidSelectedNodeChange((treeItemIds: string[]) => {
        dataProvider.setSelection(treeViewId, treeItemIds);
      }),
    );
    disposable.add(
      model.onDidChangeExpansionState((state: { treeItemId: string; expanded: boolean }) => {
        const { treeItemId, expanded } = state;
        dataProvider.setExpanded(treeViewId, treeItemId, expanded);
      }),
    );
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      disposable.add(
        handler.onActivate(() => {
          dataProvider.setVisible(treeViewId, true);
        }),
      );
      disposable.add(
        handler.onInActivate(() => {
          dataProvider.setVisible(treeViewId, false);
        }),
      );
      disposable.add(disposable.add(toDisposable(() => handler.disposeView(treeViewId))));
    }
    this.disposableCollection.set(treeViewId, disposable);
  }

  async $unregisterTreeDataProvider(treeViewId: string) {
    const disposable = this.disposableCollection.get(treeViewId);
    if (disposable) {
      disposable.dispose();
    }
  }

  async $resolveDropFileData(treeViewId: string, requestId: number, dataItemId: string) {
    const controller = this.dndControllers.get(treeViewId);
    if (!controller) {
      throw new Error('Unknown tree');
    }
    return controller.resolveDropFileData(requestId, dataItemId);
  }

  async $refresh(treeViewId: string, itemsToRefresh?: TreeViewItem) {
    const treeModel = this.treeModels.get(treeViewId);
    if (treeModel) {
      await treeModel.refresh(itemsToRefresh);
    }
  }

  async $setTitle(treeViewId: string, title: string) {
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      handler.updateViewTitle(treeViewId, title);
    }
  }

  async $setDescription(treeViewId: string, description: string) {
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      handler.updateViewDescription(treeViewId, description);
    }
  }

  async $setBadge(treeViewId: string, badge?: ViewBadge) {
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      handler.setBadge(badge ? badge : '');
      handler.accordionService.updateViewBadge(treeViewId, badge ? badge : '');
    }
  }

  async $setMessage(treeViewId: string, message: string) {
    const handler = this.mainLayoutService.getTabbarHandler(treeViewId);
    if (handler) {
      handler.updateViewMessage(treeViewId, message);
    }
  }

  async $reveal(treeViewId: string, treeItemId?: string, options?: ITreeViewRevealOptions) {
    this.mainLayoutService.revealView(treeViewId);
    const treeModel = this.treeModels.get(treeViewId);
    if (treeModel && treeItemId) {
      treeModel.reveal(treeItemId, options);
    }
  }

  private _registerInternalCommands() {
    this.disposable.add(
      this.commandRegistry.registerCommand(
        {
          id:
            this.extensionHostType === 'worker'
              ? MainThreadTreeView.TREE_VIEW_COLLAPSE_ALL_COMMAND_ID_WORKER
              : MainThreadTreeView.TREE_VIEW_COLLAPSE_ALL_COMMAND_ID,
        },
        {
          execute: (treeViewId: string) => {
            const treeModel = this.treeModels.get(treeViewId);
            if (treeModel) {
              treeModel.collapseAll();
            }
          },
        },
      ),
    );
  }
}

export class TreeViewDataProvider extends Tree {
  private cachedMenu: Map<string, MenuNode[]> = new Map();

  private onTreeDataChangedEmitter = new Emitter<any>();
  private onRevealChangedEmitter = new Emitter<any>();

  private isEmpty = true;
  private _onDidChangeEmpty: Emitter<void> = new Emitter();
  public onDidChangeEmpty: Event<void> = this._onDidChangeEmpty.event;

  private treeItemId2TreeNode: Map<string, ExtensionTreeNode | ExtensionCompositeTreeNode | ExtensionTreeRoot> =
    new Map();

  constructor(
    public readonly treeViewId: string,
    private readonly proxy: IExtHostTreeView,
    private readonly iconService: IIconService,
    private readonly themeService: IThemeService,
    private readonly labelService: LabelService,
    private readonly contextKeyService: IContextKeyService,
    private readonly menuService: AbstractMenuService,
    private readonly userhome?: URI,
  ) {
    super();
  }

  get isTreeEmpty() {
    return this.isEmpty;
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

  private getReadableDescription(item: TreeViewItem) {
    if (item.resourceUri) {
      if (this.userhome) {
        const path = URI.from(item.resourceUri);
        if (this.userhome.isEqualOrParent(path)) {
          return decodeURIComponent(item.resourceUri.path.toString().replace(this.userhome.codeUri.fsPath, '~'));
        }
      }
      return item.resourceUri.path.toString();
    }
    return item.description;
  }

  private getLabelAndDescription(item: TreeViewItem) {
    if (item.label) {
      return {
        label: item.label,
        description: item.description,
      };
    } else if (item.resourceUri) {
      let label = item.resourceUri.path.toString();
      label = decodeURIComponent(label);
      if (label.indexOf('/') >= 0) {
        label = label.substring(label.lastIndexOf('/') + 1);
      }
      const description = this.getReadableDescription(item);
      return {
        label,
        description,
      };
    }
    return {
      label: item.label,
      description: item.description,
    };
  }

  async createFoldNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionCompositeTreeNode> {
    const expanded = TreeItemCollapsibleState.Expanded === item.collapsibleState;
    const icon = await this.toIconClass(item);
    const actions = this.getInlineMenuNodes(item.contextValue || '');
    const { label, description } = this.getLabelAndDescription(item);

    const node = new ExtensionCompositeTreeNode(
      this,
      parent,
      label,
      description,
      icon,
      // TODO: Support ThemeIcon on tooltip
      typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value,
      item.command,
      item.contextValue || '',
      item.id,
      actions,
      item.checkboxInfo,
      item.accessibilityInformation,
      expanded,
      item.resourceUri,
    );
    return node;
  }

  async createNormalNode(item: TreeViewItem, parent: ExtensionCompositeTreeNode): Promise<ExtensionTreeNode> {
    const icon = await this.toIconClass(item);
    const actions = this.getInlineMenuNodes(item.contextValue || '');
    const { label, description } = this.getLabelAndDescription(item);
    const node = new ExtensionTreeNode(
      this,
      parent,
      label,
      description,
      icon,
      // TODO: Support ThemeIcon on tooltip
      typeof item.tooltip === 'string' ? item.tooltip : item.tooltip?.value,
      item.command,
      item.contextValue || '',
      item.id,
      actions,
      item.checkboxInfo,
      item.accessibilityInformation,
      item.resourceUri,
    );
    return node;
  }

  private isBase64Icon(iconPath?: IconUrl | string) {
    const isBase64Regx = /^data:image\//;
    if (iconPath) {
      if (isString(iconPath)) {
        return isBase64Regx.test(iconPath);
      } else {
        return isBase64Regx.test(iconPath.dark);
      }
    }
    return false;
  }

  async toIconClass(item: TreeViewItem): Promise<string | undefined> {
    if (item.iconUrl || item.icon) {
      return this.iconService.fromIcon(
        '',
        item.iconUrl || item.icon,
        this.isBase64Icon(item.iconUrl || item.icon) ? IconType.Base64 : IconType.Background,
        undefined,
        true,
      );
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
      return `${themeIconClass} ${themeColorClass ?? ''}`;
    } else {
      return '';
    }
  }

  private getInlineMenuNodes(viewItemValue: string) {
    if (this.cachedMenu.has(viewItemValue)) {
      return this.cachedMenu.get(viewItemValue)!;
    }

    const viewContextKey = this.contextKeyService.createScoped();

    viewContextKey.createKey('view', this.treeViewId);
    viewContextKey.createKey('viewItem', viewItemValue);
    // viewItem
    const menus = this.menuService.createMenu(MenuId.ViewItemContext, viewContextKey);
    const result = generateCtxMenu({ menus, separator: 'inline' });
    menus.dispose();
    viewContextKey.dispose();
    this.cachedMenu.set(viewItemValue, result[0]);
    return result[0];
  }

  /**
   * 创建节点
   *
   * @param item tree view item from the ext
   */
  async createTreeNode(
    item: TreeViewItem,
    parent: ExtensionCompositeTreeNode,
  ): Promise<ExtensionCompositeTreeNode | ExtensionTreeNode> {
    if (!isUndefined(item.collapsibleState) && item.collapsibleState !== TreeItemCollapsibleState.None) {
      return await this.createFoldNode(item, parent);
    }
    return await this.createNormalNode(item, parent);
  }

  async resolveChildren(
    parent?: ExtensionCompositeTreeNode,
  ): Promise<(ExtensionCompositeTreeNode | ExtensionTreeRoot | ExtensionTreeNode)[]> {
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
          this.treeItemId2TreeNode.set(child.id, node);
          nodes.push(node);
        }
      }
      if (ExtensionTreeRoot.is(parent)) {
        const oldEmpty = this.isEmpty;
        this.isEmpty = !children || children.length === 0;
        if (oldEmpty !== this.isEmpty) {
          this._onDidChangeEmpty.fire();
        }
      }
    } else {
      nodes = [new ExtensionTreeRoot(this, this.treeViewId)];
    }
    return nodes;
  }

  async resolveTreeItem(treeViewId: string, treeItemId: string) {
    const token = new CancellationTokenSource().token;
    return this.proxy.$resolveTreeItem(treeViewId, treeItemId, token);
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

  markAsChecked(
    node: ExtensionTreeNode | ExtensionCompositeTreeNode,
    checked: boolean,
    manageCheckboxStateManually?: boolean,
  ): void {
    function findParentsToChange(child: ITreeNodeOrCompositeTreeNode, nodes: ITreeNodeOrCompositeTreeNode[]): void {
      if (
        child.parent?.checkboxInfo !== undefined &&
        child.parent.checkboxInfo.checked !== checked &&
        (!checked ||
          !child.parent.children?.some((candidate) => candidate !== child && candidate.checkboxInfo?.checked === false))
      ) {
        nodes.push(child.parent);
        findParentsToChange(child.parent, nodes);
      }
    }

    function findChildrenToChange(parent: ITreeNodeOrCompositeTreeNode, nodes: ITreeNodeOrCompositeTreeNode[]): void {
      if (CompositeTreeNode.is(parent)) {
        parent.children?.forEach((child) => {
          if (child.checkboxInfo !== undefined && child.checkboxInfo.checked !== checked) {
            nodes.push(child);
          }
          findChildrenToChange(child, nodes);
        });
      }
    }

    const nodesToChange = [node];
    if (!manageCheckboxStateManually) {
      findParentsToChange(node, nodesToChange);
      findChildrenToChange(node, nodesToChange);
    }
    nodesToChange.forEach((n) => (n.checkboxInfo!.checked = checked));
    this.proxy?.$checkStateChanged(this.treeViewId, [{ treeItemId: node.treeItemId, checked }]);
  }
}

export class TreeViewDragAndDropController extends Disposable implements ITreeViewDragAndDropController {
  private readonly dataTransfersCache = new DataTransferCache();

  constructor(
    public readonly treeViewId: string,
    readonly dropMimeTypes: string[] = [],
    readonly dragMimeTypes: string[] = [],
    public readonly hasHandleDrag: boolean,
    private readonly _proxy: IExtHostTreeView,
  ) {
    super();
  }

  async handleDrop(
    dataTransfer: VSDataTransfer,
    targetTreeItem: ExtensionTreeNode | ExtensionCompositeTreeNode | undefined,
    token: CancellationToken,
    operationUuid?: string,
    sourceTreeId?: string,
    sourceTreeItemHandles?: string[],
  ): Promise<void> {
    const request = this.dataTransfersCache.add(dataTransfer);
    try {
      return await this._proxy.$handleDrop(
        this.treeViewId,
        request.id,
        await DataTransfer.toDataTransferDTO(dataTransfer),
        targetTreeItem?.treeItemId,
        token,
        operationUuid,
        sourceTreeId,
        sourceTreeItemHandles,
      );
    } finally {
      request.dispose();
    }
  }

  async handleDrag(
    sourceTreeItemHandles: string[],
    operationUuid: string,
    token: CancellationToken,
  ): Promise<VSDataTransfer | undefined> {
    if (!this.hasHandleDrag) {
      return;
    }
    const additionalDataTransferDTO = await this._proxy.$handleDrag(
      this.treeViewId,
      sourceTreeItemHandles,
      operationUuid,
      token,
    );
    if (!additionalDataTransferDTO) {
      return;
    }

    const additionalDataTransfer = new VSDataTransfer();
    additionalDataTransferDTO.items.forEach(([type, item]) => {
      additionalDataTransfer.replace(type, createStringDataTransferItem(item.asString));
    });
    return additionalDataTransfer;
  }

  public resolveDropFileData(requestId: number, dataItemId: string): Promise<BinaryBuffer> {
    return this.dataTransfersCache.resolveDropFileData(requestId, dataItemId);
  }
}
