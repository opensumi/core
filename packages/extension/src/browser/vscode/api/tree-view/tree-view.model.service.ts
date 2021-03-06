import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  DecorationsManager,
  Decoration,
  IRecycleTreeHandle,
  TreeNodeType,
  PromptValidateMessage,
  TreeNodeEvent,
  WatchEvent,
  TreeNode,
  CompositeTreeNode,
} from '@opensumi/ide-components';
import {
  DisposableCollection,
  Emitter,
  PreferenceService,
  IContextKeyService,
  Deferred,
  ThrottledDelayer,
  CommandService,
} from '@opensumi/ide-core-browser';
import {
  AbstractMenuService,
  ICtxMenuRenderer,
  generateCtxMenu,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { isUndefinedOrNull, isNumber } from '@opensumi/ide-core-common';

import { ITreeViewRevealOptions, TreeViewBaseOptions, TreeViewItem } from '../../../../common/vscode';
import { TreeViewDataProvider } from '../main.thread.treeview';

import styles from './tree-view-node.module.less';
import { ExtensionTreeModel } from './tree-view.model';
import { ExtensionCompositeTreeNode, ExtensionTreeNode, ExtensionTreeRoot } from './tree-view.node.defined';

export const IExtensionTreeViewModel = Symbol('IExtensionTreeViewModel');

export const ITreeViewId = Symbol('ITreeViewId');
export const ITreeViewBaseOptions = Symbol('TreeViewBaseOptions');

export interface IExtensionTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export interface ExtensionTreeValidateMessage extends PromptValidateMessage {
  value: string;
}

const ITreeViewDataProvider = Symbol('ITreeViewDataProvider');

@Injectable()
export class ExtensionTreeViewModel {
  static DEFAULT_REVEAL_DELAY = 500;

  static createContainer(
    injector: Injector,
    tree: TreeViewDataProvider,
    treeViewId: string,
    options: TreeViewBaseOptions,
  ): Injector {
    const child = injector.createChild([
      {
        token: ITreeViewDataProvider,
        useValue: tree,
      },
      {
        token: IExtensionTreeViewModel,
        useClass: ExtensionTreeViewModel,
      },
      {
        token: ITreeViewId,
        useValue: treeViewId,
      },
      {
        token: ITreeViewBaseOptions,
        useValue: options,
      },
    ]);
    return child;
  }

  static createModel(
    injector: Injector,
    tree: TreeViewDataProvider,
    treeViewId: string,
    options: TreeViewBaseOptions,
  ): ExtensionTreeViewModel {
    return ExtensionTreeViewModel.createContainer(injector, tree, treeViewId, options).get(IExtensionTreeViewModel);
  }

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ITreeViewDataProvider)
  private readonly treeViewDataProvider: TreeViewDataProvider;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ITreeViewId)
  public readonly treeViewId: string;

  @Autowired(ITreeViewBaseOptions)
  public readonly treeViewOptions: TreeViewBaseOptions;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private _treeModel: ExtensionTreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _extensionTreeHandle: IExtensionTreeHandle;

  // ?????????
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // ?????????
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // ?????????
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // ?????????????????????
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // ?????????
  // ???????????????????????????????????????????????????????????????
  private _focusedNode: ExtensionTreeNode | ExtensionCompositeTreeNode | undefined;
  // ???????????????????????????????????????
  private _selectedNodes: (ExtensionTreeNode | ExtensionCompositeTreeNode)[] = [];
  // ??????????????????????????????
  private _contextMenuNode: ExtensionTreeNode | ExtensionCompositeTreeNode | undefined;
  private clickTimes: number;
  private clickTimer: any;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidFocusedNodeChangeEmitter: Emitter<string | void> = new Emitter();
  private onDidSelectedNodeChangeEmitter: Emitter<string[]> = new Emitter();
  private onDidChangeExpansionStateEmitter: Emitter<{
    treeItemId: string;
    expanded: boolean;
  }> = new Emitter();

  private _isMultiSelected = false;
  private revealDelayer = new ThrottledDelayer<void>(ExtensionTreeViewModel.DEFAULT_REVEAL_DELAY);
  private revealDeferred: Deferred<void> | null;
  private refreshDeferred: Deferred<void> | null;

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get onDidFocusedNodeChange() {
    return this.onDidFocusedNodeChangeEmitter.event;
  }

  get onDidChangeExpansionState() {
    return this.onDidChangeExpansionStateEmitter.event;
  }

  get onDidSelectedNodeChange() {
    return this.onDidSelectedNodeChangeEmitter.event;
  }

  get extensionTreeHandle() {
    return this._extensionTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
  }

  get whenReady() {
    return this._whenReady;
  }

  // ???????????????????????????????????????
  get focusedNode() {
    return this._focusedNode;
  }

  // ?????????????????????????????????
  get selectedNodes() {
    return this._selectedNodes;
  }

  // ???????????????????????????
  get contextMenuNode() {
    return this._contextMenuNode;
  }

  async initTreeModel() {
    // ????????????????????????????????????????????????
    const root = (await this.treeViewDataProvider.resolveChildren())[0];
    this._treeModel = this.injector.get<any>(ExtensionTreeModel, [root]);

    this.initDecorations(root);
    this.disposableCollection.push(this.treeViewDataProvider);
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
        this.loadingDecoration.addTarget(target);
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
      }),
    );
    this.disposableCollection.push(
      this.treeModel.root.watcher.on(
        TreeNodeEvent.DidChangeExpansionState,
        (target: ExtensionTreeNode, nowExpanded) => {
          this.onDidChangeExpansionStateEmitter.fire({
            treeItemId: target.treeItemId,
            expanded: nowExpanded,
          });
        },
      ),
    );
    this.disposableCollection.push(
      this.treeViewDataProvider.onTreeDataChanged((itemsToRefresh?: TreeViewItem) => {
        this.refresh(itemsToRefresh);
      }),
    );
    this.disposableCollection.push(
      this.treeViewDataProvider.onRevealChanged((treeItemId: string) => {
        this.reveal(treeItemId);
      }),
    );
    this.disposableCollection.push(
      this.treeViewDataProvider.onRevealChanged((treeItemId: string) => {
        this.reveal(treeItemId);
      }),
    );
    this.disposableCollection.push(
      this.treeModel!.onWillUpdate(() => {
        // ?????????????????????????????????
        if (this.selectedNodes.length !== 0) {
          // ???????????????????????????
          const node = this.treeModel?.root.getTreeNodeByPath(this.selectedNodes[0].path);
          this.selectedDecoration.addTarget(node as ExtensionTreeNode);
        }
      }),
    );
  }

  async updateTreeModel() {
    const root = await this.treeViewDataProvider.resolveChildren()[0];
    this._treeModel = this.injector.get<any>(ExtensionTreeModel, [root]);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // ???????????????????????????
  clearNodeSelectedDecoration = () => {
    this._selectedNodes.forEach((node) => {
      this.selectedDecoration.removeTarget(node);
    });
    this._selectedNodes = [];
    this.onDidSelectedNodeChangeEmitter.fire([]);
  };

  // ??????????????????/??????????????????????????????????????????
  activeNodeDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    if (target === (this.treeModel.root as TreeNode)) {
      // ?????????????????????
      return;
    }

    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
      this._contextMenuNode = undefined;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        // ?????????????????????????????????????????????????????????????????????selectedNodes?????????
        // ?????????????????????????????????????????????????????????????????????
        for (const target of this.selectedDecoration.appliedTargets.keys()) {
          this.selectedDecoration.removeTarget(target);
        }
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];
      // ???????????????????????????
      this.onDidFocusedNodeChangeEmitter.fire(target.treeItemId);
      this.onDidSelectedNodeChangeEmitter.fire([target.treeItemId]);
      // ??????????????????
      this.treeModel.dispatchChange();
    }
  };

  // ?????????????????????????????????????????????????????????
  // removePreFocusedDecoration ??????????????????????????????????????????????????????????????????????????????????????????????????????
  activeNodeFocusedDecoration = (
    target: ExtensionTreeNode | ExtensionCompositeTreeNode,
    removePreFocusedDecoration = false,
    clearSelection = false,
  ) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
      return;
    }

    if (this.focusedNode !== target) {
      if (removePreFocusedDecoration) {
        if (this.focusedNode) {
          // ??????????????????????????????????????????
          this.focusedDecoration.removeTarget(this.focusedNode);
        }
        this._contextMenuNode = target;
      } else if (this.focusedNode) {
        this._contextMenuNode = undefined;
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      if (target) {
        if (clearSelection) {
          for (const node of this._selectedNodes) {
            this.selectedDecoration.removeTarget(node);
          }
          this._selectedNodes = [];
        }
        if (this._selectedNodes.indexOf(target) < 0) {
          this.selectedDecoration.addTarget(target);
          this._selectedNodes.push(target);
          // ??????????????????????????????
          this.onDidSelectedNodeChangeEmitter.fire(this._selectedNodes.map((node) => node.treeItemId));
        }
        this.focusedDecoration.addTarget(target);
        this._focusedNode = target;
        // ??????????????????????????????
        this.onDidFocusedNodeChangeEmitter.fire(target.treeItemId);
      }
    }
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ???????????????????????????
  activeNodeActivedDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
    }
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this._focusedNode = undefined;
    }
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuNode = target;
    this.treeModel.dispatchChange();
  };

  // ??????????????????/??????????????????????????????????????????
  selectNodeDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // ?????????????????????
      return;
    }

    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
      this._contextMenuNode = undefined;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.selectedNodes.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this._selectedNodes = [target];
      // ???????????????????????????
      this.onDidSelectedNodeChangeEmitter.fire([target.treeItemId]);
      // ??????????????????
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // ????????????????????????????????????????????????
  activeNodeSelectedDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    if (this._selectedNodes.indexOf(target) > -1) {
      return;
    }
    this._selectedNodes.push(target);
    this.selectedDecoration.addTarget(target);
    // ??????????????????
    this.onDidSelectedNodeChangeEmitter.fire(this._selectedNodes.map((node) => node.treeItemId));
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ??????????????????????????????
  activeNodeDecorationByRange = (begin: number, end: number) => {
    this.clearNodeSelectedDecoration();
    this._contextMenuNode = undefined;
    for (; begin <= end; begin++) {
      const node = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (node) {
        this._selectedNodes.push(node as ExtensionTreeNode);
        this.selectedDecoration.addTarget(node);
      }
    }
    // ??????????????????
    this.onDidSelectedNodeChangeEmitter.fire(this._selectedNodes.map((node) => node.treeItemId));
    // ??????????????????
    this.treeModel.dispatchChange();
  };

  // ????????????????????????
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.onDidFocusedNodeChangeEmitter.fire();
      this._focusedNode = undefined;
    }
    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
    }
    this.treeModel?.dispatchChange();
  };

  toggleDirectory = async (item: ExtensionCompositeTreeNode) => {
    if (item.expanded) {
      this.extensionTreeHandle.collapseNode(item);
    } else {
      this.extensionTreeHandle.expandNode(item);
    }
  };

  removeNodeDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
    this.decorations.removeDecoration(this.contextMenuDecoration);
    this.decorations.removeDecoration(this.loadingDecoration);
  }

  handleTreeHandler(handle: IExtensionTreeHandle) {
    this._extensionTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // ??????????????????
    this.enactiveNodeDecoration();
  };

  handleTreeFocus = () => {
    // ????????????
  };

  handleItemRangeClick = (item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
    if (!this.focusedNode) {
      this.handleItemClick(item, type);
    } else if (this.focusedNode && this.focusedNode !== item) {
      this._isMultiSelected = true;
      const targetIndex = this.treeModel.root.getIndexAtTreeNode(item);
      const preFocusedNodeIndex = this.treeModel.root.getIndexAtTreeNode(this.focusedNode);
      if (preFocusedNodeIndex > targetIndex) {
        this.activeNodeDecorationByRange(targetIndex, preFocusedNodeIndex);
      } else if (preFocusedNodeIndex < targetIndex) {
        this.activeNodeDecorationByRange(preFocusedNodeIndex, targetIndex);
      }
    }
  };

  handleItemToggleClick = (item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
    this._isMultiSelected = true;
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }
    // ???????????????????????????????????????????????????????????????????????????
    // ??????????????????????????????
    if (this.selectedNodes.indexOf(item) > -1) {
      if (this.focusedNode === item) {
        this.enactiveNodeDecoration();
      } else {
        this.activeNodeFocusedDecoration(item);
      }
    } else {
      this.activeNodeSelectedDecoration(item);
    }
  };

  handleItemClick = async (item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
    this._isMultiSelected = false;
    // ???????????????????????????????????????
    if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode) {
      this.activeNodeDecoration(item);
    }
    if (!item.resolved) {
      await item.resolveTreeItem();
    }
    if (item.command) {
      this.commandService.executeCommand(item.command.id, ...(item.command.arguments || []));
    } else {
      this.clickTimes++;
      if (type === TreeNodeType.CompositeTreeNode) {
        if (this.preferenceService.get('workbench.list.openMode') === 'singleClick') {
          this.toggleDirectory(item as ExtensionCompositeTreeNode);
        }
      }
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
      }
      this.clickTimer = setTimeout(() => {
        // ????????????
        // 200ms????????????????????????????????????
        if (this.clickTimes > 1) {
          if (type !== TreeNodeType.TreeNode) {
            if (this.preferenceService.get('workbench.list.openMode') === 'doubleClick') {
              this.toggleDirectory(item as ExtensionCompositeTreeNode);
            }
          }
        }
        this.clickTimes = 0;
      }, 200);
    }
  };

  handleContextMenu = (ev: React.MouseEvent, item?: ExtensionCompositeTreeNode | ExtensionTreeNode) => {
    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;

    if (item) {
      this.activeNodeActivedDecoration(item);
    } else {
      this.enactiveNodeDecoration();
    }
    let nodes: (ExtensionTreeNode | ExtensionCompositeTreeNode)[];
    let node: ExtensionTreeNode | ExtensionCompositeTreeNode;

    if (!item) {
      // ????????????????????????
      nodes = [this.treeModel.root as ExtensionCompositeTreeNode];
      node = this.treeModel.root as ExtensionCompositeTreeNode;
    } else {
      node = item;
      if (this._isMultiSelected) {
        if (this.selectedNodes.indexOf(node) >= 0) {
          nodes = this._isMultiSelected ? this.selectedNodes : [node];
        } else {
          nodes = this._isMultiSelected ? this.selectedNodes.concat([node]) : [node];
        }
      } else {
        nodes = [node];
      }
    }

    const menuNodes = this.getCtxMenuNodes(node.contextValue);
    const ctxMenuRenderer: ICtxMenuRenderer = this.injector.get(ICtxMenuRenderer);

    ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [
        { treeViewId: this.treeViewId, treeItemId: node.treeItemId },
        nodes.map((node) => ({ treeViewId: this.treeViewId, treeItemId: node.treeItemId })),
      ],
    });
  };

  private getCtxMenuNodes(viewItemValue: string) {
    return this.getMenuNodes(viewItemValue)[1];
  }

  private getMenuNodes(viewItemValue: string) {
    const viewContextKey = this.contextKeyService.createScoped();

    viewContextKey.createKey('view', this.treeViewId);
    viewContextKey.createKey('viewItem', viewItemValue);

    // viewItem
    const menus = this.menuService.createMenu(MenuId.ViewItemContext, viewContextKey);
    const result = generateCtxMenu({ menus, separator: 'inline' });
    menus.dispose();
    viewContextKey.dispose();

    return result;
  }

  public getInlineMenuNodes(viewItemValue: string) {
    return this.getMenuNodes(viewItemValue)[0];
  }

  public collapseAll() {
    this.treeModel.root.collapsedAll();
  }

  async refresh(item?: TreeViewItem) {
    await this.whenReady;
    if (!item) {
      await this.treeModel.root?.refresh();
    } else {
      const id = this.treeViewDataProvider.getTreeNodeIdByTreeItemId(item.id);
      if (!id) {
        return;
      }
      const treeNode = (this.treeModel.root as ExtensionTreeRoot).getTreeNodeById(id);
      if (!treeNode) {
        return;
      }
      if (ExtensionCompositeTreeNode.is(treeNode)) {
        await (treeNode as ExtensionCompositeTreeNode).refresh();
      } else if (treeNode.parent) {
        await (treeNode.parent as ExtensionCompositeTreeNode).refresh();
      }
    }
  }

  async reveal(treeItemId: string, options: ITreeViewRevealOptions = {}) {
    await this.whenReady;
    if (!this.revealDelayer.isTriggered()) {
      this.revealDelayer.cancel();
    } else if (this.revealDeferred) {
      await this.revealDeferred.promise;
    }
    return this.revealDelayer.trigger(async () => {
      this.revealDeferred = new Deferred();
      if (this.treeModel.root.branchSize === 0) {
        // ???Tree????????????????????????Tree
        await this.refresh();
      }
      const id = this.treeViewDataProvider.getTreeNodeIdByTreeItemId(treeItemId);
      if (!id) {
        return;
      }
      const cache = (this.treeModel.root as ExtensionTreeRoot).getTreeNodeById(id);
      if (!cache) {
        return;
      }

      const select = isUndefinedOrNull(options.select) ? false : options.select;
      const focus = isUndefinedOrNull(options.focus) ? false : options.focus;
      // ???????????????????????????????????????
      let expand = Math.min(isNumber(options.expand) ? options.expand : options.expand === true ? 1 : 0, 3);

      let itemsToExpand = await this.extensionTreeHandle.ensureVisible(cache.path);
      if (itemsToExpand) {
        if (select) {
          // ???????????????????????????????????????????????????
          this.selectNodeDecoration(itemsToExpand as ExtensionTreeNode);
        }
        if (focus) {
          // ?????????????????????????????????????????????
          this.activeNodeFocusedDecoration(itemsToExpand as ExtensionTreeNode, false, true);
        }
      }
      for (
        ;
        ExtensionCompositeTreeNode.is(itemsToExpand) &&
        (itemsToExpand as ExtensionCompositeTreeNode).branchSize > 0 &&
        expand > 0;
        expand--
      ) {
        await this.extensionTreeHandle.expandNode(itemsToExpand as CompositeTreeNode);
        itemsToExpand = itemsToExpand?.children ? (itemsToExpand?.children[0] as TreeNode) : undefined;
      }
      this.revealDeferred.resolve();
      this.revealDeferred = null;
    });
  }
}
