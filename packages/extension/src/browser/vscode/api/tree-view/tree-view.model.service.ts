import { DragEvent, MouseEvent } from 'react';

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
  TargetMatchMode,
} from '@opensumi/ide-components';
import {
  DisposableCollection,
  Emitter,
  PreferenceService,
  IContextKeyService,
  Deferred,
  ThrottledDelayer,
  CommandService,
  LabelService,
} from '@opensumi/ide-core-browser';
import {
  AbstractMenuService,
  ICtxMenuRenderer,
  generateCtxMenu,
  MenuId,
} from '@opensumi/ide-core-browser/lib/menu/next';
import {
  isUndefinedOrNull,
  isNumber,
  CancellationToken,
  Disposable,
  BinaryBuffer,
  Uri,
  URI,
  ILogger,
  CancellationTokenSource,
  uuid,
  Mimes,
  Schemes,
} from '@opensumi/ide-core-common';

import {
  ITreeViewRevealOptions,
  ITreeViewsService as ITreeViewsServiceCommon,
  TreeViewBaseOptions,
  TreeViewItem,
  TreeviewsService,
} from '../../../../common/vscode';
import {
  CodeDataTransfers,
  DataTransfers,
  DraggedTreeItemsIdentifier,
  LocalSelectionTransfer,
  toVSDataTransfer,
  VSDataTransfer,
} from '../../../../common/vscode/data-transfer';
import { TreeViewDataProvider, TreeViewDragAndDropController } from '../main.thread.treeview';

import styles from './tree-view-node.module.less';
import { ExtensionTreeModel } from './tree-view.model';
import { ExtensionCompositeTreeNode, ExtensionTreeNode, ExtensionTreeRoot } from './tree-view.node.defined';

export const IExtensionTreeViewModel = Symbol('IExtensionTreeViewModel');

export const ITreeViewId = Symbol('ITreeViewId');
export const ITreeViewBaseOptions = Symbol('TreeViewBaseOptions');
export const ITreeViewDragAndDropController = Symbol('ITreeViewDragAndDropController');

export interface ITreeViewDragAndDropController {
  readonly dropMimeTypes: string[];
  readonly dragMimeTypes: string[];
  handleDrag(
    sourceTreeItemHandles: string[],
    operationUuid: string,
    token: CancellationToken,
  ): Promise<VSDataTransfer | undefined>;
  handleDrop(
    elements: VSDataTransfer,
    target: ExtensionTreeNode | ExtensionCompositeTreeNode | undefined,
    token: CancellationToken,
    operationUuid?: string,
    sourceTreeId?: string,
    sourceTreeItemHandles?: string[],
  ): Promise<void>;
}

interface TreeDragSourceInfo {
  id: string;
  itemHandles: string[];
}

export interface IExtensionTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export interface ExtensionTreeValidateMessage extends PromptValidateMessage {
  value: string;
}
export type ITreeViewsService = ITreeViewsServiceCommon<VSDataTransfer, TreeViewItem, HTMLElement>;
export const ITreeViewsService = Symbol('ITreeViewsService');

const ITreeViewDataProvider = Symbol('ITreeViewDataProvider');

@Injectable()
export class ExtensionTreeViewModel {
  static DEFAULT_REVEAL_DELAY = 500;
  static MS_TILL_DRAGGED_OVER_EXPANDS = 500;

  static createContainer(
    injector: Injector,
    tree: TreeViewDataProvider,
    dndController: TreeViewDragAndDropController,
    treeViewId: string,
    options: TreeViewBaseOptions,
  ): Injector {
    const child = injector.createChild([
      {
        token: ITreeViewDataProvider,
        useValue: tree,
      },
      {
        token: ITreeViewDragAndDropController,
        useValue: dndController,
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
      {
        token: ITreeViewsService,
        useValue: new TreeviewsService(),
      },
    ]);
    return child;
  }

  static createModel(
    injector: Injector,
    tree: TreeViewDataProvider,
    dndController: TreeViewDragAndDropController,
    treeViewId: string,
    options: TreeViewBaseOptions,
  ): ExtensionTreeViewModel {
    return ExtensionTreeViewModel.createContainer(injector, tree, dndController, treeViewId, options).get(
      IExtensionTreeViewModel,
    );
  }

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ITreeViewDataProvider)
  private readonly treeViewDataProvider: TreeViewDataProvider;

  @Autowired(ITreeViewDragAndDropController)
  private readonly treeViewDragAndDropController: TreeViewDragAndDropController;

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

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(ITreeViewsService)
  private readonly treeViewsDragAndDropService: ITreeViewsService;

  private _treeModel: ExtensionTreeModel;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _extensionTreeHandle: IExtensionTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  private draggingDecoration: Decoration = new Decoration(styles.mod_dragging); // Dragging 态
  private draggedOverDecoration: Decoration = new Decoration(styles.mod_dragover); // Dragover 态

  // 上一次拖拽进入的目录
  private potentialParent: ExtensionCompositeTreeNode | null;
  // 开始拖拽的节点
  private beingDraggedNodes: (ExtensionTreeNode | ExtensionCompositeTreeNode)[] = [];

  // 即使选中态也是焦点态的节点，全局仅会有一个
  private _focusedNode: ExtensionTreeNode | ExtensionCompositeTreeNode | undefined;
  // 选中态的节点，会可能有多个
  private _selectedNodes: (ExtensionTreeNode | ExtensionCompositeTreeNode)[] = [];
  // 右键菜单激活态的节点
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

  private toCancelNodeExpansion: DisposableCollection = new DisposableCollection();
  private draggedOverNode: ExtensionTreeNode | ExtensionCompositeTreeNode;

  private dragOverTrigger = new ThrottledDelayer<void>(ExtensionTreeViewModel.MS_TILL_DRAGGED_OVER_EXPANDS);
  private dragCancellationToken: CancellationTokenSource | undefined;
  private readonly treeItemsTransfer = LocalSelectionTransfer.getInstance<DraggedTreeItemsIdentifier>();

  private readonly treeMimeType: string;

  constructor() {
    this._whenReady = this.initTreeModel();
    this.treeMimeType = `application/vnd.code.tree.${this.treeViewId.toLowerCase()}`;
  }

  get draggable() {
    return this.treeViewDragAndDropController.hasHandleDrag;
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

  // 既是选中态，也是焦点态节点
  get focusedNode() {
    return this._focusedNode;
  }

  // 是选中态，非焦点态节点
  get selectedNodes() {
    return this._selectedNodes;
  }

  // 右键菜单激活态节点
  get contextMenuNode() {
    return this._contextMenuNode;
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
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
        // 更新树前更新下选中节点
        if (this.selectedNodes.length !== 0) {
          // 仅处理一下单选情况
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
    this._decorations.addDecoration(this.draggedOverDecoration);
    this._decorations.addDecoration(this.draggingDecoration);
  }

  // 清空所有节点选中态
  clearNodeSelectedDecoration = () => {
    this._selectedNodes.forEach((node) => {
      this.selectedDecoration.removeTarget(node);
    });
    this._selectedNodes = [];
    this.onDidSelectedNodeChangeEmitter.fire([]);
  };

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    if (target === (this.treeModel.root as TreeNode)) {
      // 根节点不能选中
      return;
    }

    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
      this._contextMenuNode = undefined;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        // 因为选择装饰器可能通过其他方式添加而不能及时在selectedNodes上更新
        // 故这里遍历所有选中装饰器的节点进行一次统一清理
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
      // 选中及焦点文件变化
      this.onDidFocusedNodeChangeEmitter.fire(target.treeItemId);
      this.onDidSelectedNodeChangeEmitter.fire([target.treeItemId]);
      // 通知视图更新
      this.treeModel.dispatchChange();
    }
  };

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeNodeFocusedDecoration = (
    target: ExtensionTreeNode | ExtensionCompositeTreeNode,
    removePreFocusedDecoration = false,
    clearSelection = false,
  ) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.focusedNode !== target) {
      if (removePreFocusedDecoration) {
        if (this.focusedNode) {
          // 多选情况下第一次切换焦点文件
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
          // 事件通知选中状态变化
          this.onDidSelectedNodeChangeEmitter.fire(this._selectedNodes.map((node) => node.treeItemId));
        }
        this.focusedDecoration.addTarget(target);
        this._focusedNode = target;
        // 事件通知焦点状态变化
        this.onDidFocusedNodeChangeEmitter.fire(target.treeItemId);
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 右键菜单焦点态切换
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

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectNodeDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode, dispatchChange = true) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
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
      // 选中及焦点文件变化
      this.onDidSelectedNodeChangeEmitter.fire([target.treeItemId]);
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  };

  // 选中当前指定节点，添加装饰器属性
  activeNodeSelectedDecoration = (target: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    if (this._selectedNodes.indexOf(target) > -1) {
      return;
    }
    this._selectedNodes.push(target);
    this.selectedDecoration.addTarget(target);
    // 选中状态变化
    this.onDidSelectedNodeChangeEmitter.fire(this._selectedNodes.map((node) => node.treeItemId));
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 选中范围内的所有节点
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
    // 选中状态变化
    this.onDidSelectedNodeChangeEmitter.fire(this._selectedNodes.map((node) => node.treeItemId));
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 取消选中节点焦点
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
    this.decorations.removeDecoration(this.draggedOverDecoration);
    this.decorations.removeDecoration(this.draggingDecoration);
  }

  handleTreeHandler(handle: IExtensionTreeHandle) {
    this._extensionTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveNodeDecoration();
  };

  handleTreeFocus = () => {
    // 激活面板
  };

  getDragURI(element: ExtensionTreeNode | ExtensionCompositeTreeNode): string | null {
    if (!this.treeViewDragAndDropController.handleDrag) {
      return null;
    }
    return element.uri ? Uri.revive(element.uri).toString() : element.treeItemId;
  }

  getDragLabel(elements: (ExtensionTreeNode | ExtensionCompositeTreeNode)[]): string | undefined {
    if (!this.treeViewDragAndDropController.handleDrag) {
      return undefined;
    }
    if (elements.length > 1) {
      return String(elements.length);
    }
    const element = elements[0];
    return element.displayName
      ? element.displayName
      : element.uri
      ? this.labelService.getName(URI.from(element.uri))
      : undefined;
  }

  private handleDragAndLog(
    dndController: ITreeViewDragAndDropController,
    itemHandles: string[],
    uuid: string,
    dragCancellationToken: CancellationToken,
  ): Promise<VSDataTransfer | undefined> {
    return dndController.handleDrag(itemHandles, uuid, dragCancellationToken).then((additionalDataTransfer) => {
      if (additionalDataTransfer) {
        const unlistedTypes: string[] = [];
        for (const item of additionalDataTransfer.entries()) {
          if (
            item[0] !== this.treeMimeType &&
            dndController.dragMimeTypes.findIndex((value) => value === item[0]) < 0
          ) {
            unlistedTypes.push(item[0]);
          }
        }
        if (unlistedTypes.length) {
          this.logger.warn(
            `Drag and drop controller for tree ${
              this.treeViewId
            } adds the following data transfer types but does not declare them in dragMimeTypes: ${unlistedTypes.join(
              ', ',
            )}`,
          );
        }
      }
      return additionalDataTransfer;
    });
  }

  private addExtensionProvidedTransferTypes(event: DragEvent, itemHandles: string[]) {
    if (!event.dataTransfer || !this.treeViewDragAndDropController) {
      return;
    }
    const uid = uuid();

    this.dragCancellationToken = new CancellationTokenSource();
    this.treeViewsDragAndDropService.addDragOperationTransfer(
      uid,
      this.handleDragAndLog(this.treeViewDragAndDropController, itemHandles, uid, this.dragCancellationToken.token),
    );
    this.treeItemsTransfer.setData([new DraggedTreeItemsIdentifier(uid)], DraggedTreeItemsIdentifier.prototype);
    if (this.treeViewDragAndDropController.dragMimeTypes.find((element) => element === Mimes.uriList)) {
      // Add the type that the editor knows
      event.dataTransfer?.setData(DataTransfers.RESOURCES, '');
    }
    this.treeViewDragAndDropController.dragMimeTypes.forEach((supportedType) => {
      event.dataTransfer?.setData(supportedType, '');
    });
  }

  private addResourceInfoToTransfer(event: DragEvent, resources: Uri[]) {
    if (resources.length && event.dataTransfer) {
      // TODO: Apply some datatransfer types to allow for dragging the element outside of the application

      // The only custom data transfer we set from the explorer is a file transfer
      // to be able to DND between multiple code file explorers across windows
      const fileResources = resources.filter((s) => s.scheme === Schemes.file).map((r) => r.fsPath);
      if (fileResources.length) {
        event.dataTransfer.setData(CodeDataTransfers.FILES, JSON.stringify(fileResources));
      }
    }
  }

  handleDragStart = (event: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    event.stopPropagation();
    // React DragEnd Event maybe not fired for the last renderred element.
    // ref: https://stackoverflow.com/a/24543568
    const handleDragEnd = (ev) => {
      this.handleDragEnd(ev, node);
    };
    event.currentTarget.addEventListener('dragend', handleDragEnd, false);

    const draggedNodes = this.selectedNodes.length === 0 ? [node] : this.selectedNodes;
    const resources: Uri[] = [];
    const sourceInfo: TreeDragSourceInfo = {
      id: this.treeViewId,
      itemHandles: [] as string[],
    };
    draggedNodes.forEach((item: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
      sourceInfo.itemHandles.push(item.treeItemId);
      if (item.uri) {
        resources.push(URI.revive(item.uri));
      }
    });
    this.addResourceInfoToTransfer(event, resources);
    this.addExtensionProvidedTransferTypes(event, sourceInfo.itemHandles);
    event.dataTransfer.setData(this.treeMimeType, JSON.stringify(sourceInfo));

    draggedNodes.forEach((node) => {
      // 添加拖拽样式
      this.draggingDecoration.addTarget(node, TargetMatchMode.Self);
    });

    if (event.dataTransfer) {
      const label = this.getDragLabel(draggedNodes) || '';
      const dragImage = document.createElement('div');
      dragImage.className = styles.tree_view_drag_image;
      dragImage.textContent = label;
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, -10, -10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  handleDragEnter = (event: DragEvent, _node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    event.stopPropagation();
    event.preventDefault();
  };

  handleDrop = async (event: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (node) {
      this.draggingDecoration.removeTarget(node);
    }
    if (this.potentialParent) {
      this.draggedOverDecoration.removeTarget(this.potentialParent);
    }
    // Remove all dragging decoration
    this.beingDraggedNodes.forEach((node) => {
      this.draggingDecoration.removeTarget(node);
    });
    this.beingDraggedNodes = [];
    this.potentialParent = null;
    this.treeModel.dispatchChange();
    if (!this.toCancelNodeExpansion.disposed) {
      this.toCancelNodeExpansion.dispose();
    }

    const dndController = this.treeViewDragAndDropController;
    if (!event.dataTransfer || !dndController) {
      return;
    }
    const originalDataTransfer = toVSDataTransfer(event.dataTransfer);

    let treeSourceInfo: TreeDragSourceInfo | undefined;
    let willDropUuid: string | undefined;
    if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
      willDropUuid = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype)![0].identifier;
    }

    // TODO: Handle Editor Drop Data

    const outDataTransfer = new VSDataTransfer();
    for (const [type, item] of originalDataTransfer.entries()) {
      if (
        type === this.treeMimeType ||
        dndController.dropMimeTypes.includes(type) ||
        (item.asFile() && dndController.dropMimeTypes.includes(DataTransfers.FILES.toLowerCase()))
      ) {
        outDataTransfer.append(type, item);
        if (type === this.treeMimeType) {
          try {
            treeSourceInfo = JSON.parse(await item.asString());
          } catch {
            // noop
          }
        }
      }
    }

    const additionalDataTransfer = await this.treeViewsDragAndDropService.removeDragOperationTransfer(willDropUuid);
    if (additionalDataTransfer) {
      for (const [type, item] of additionalDataTransfer.entries()) {
        outDataTransfer.append(type, item);
      }
    }
    return dndController.handleDrop(
      outDataTransfer,
      node,
      CancellationToken.None,
      willDropUuid,
      treeSourceInfo?.id,
      treeSourceInfo?.itemHandles,
    );
  };

  handleDragOver = (event: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    event.preventDefault();
    event.stopPropagation();
    // TODO: Handle Editor Drop Data
    if (!this.toCancelNodeExpansion.disposed) {
      return;
    }
    if (this.beingDraggedNodes.indexOf(node) >= 0) {
      return;
    }

    this.draggedOverNode = node;

    const newPotentialParent: ExtensionCompositeTreeNode =
      ExtensionCompositeTreeNode.is(node) && (node as ExtensionCompositeTreeNode).expanded
        ? (node as ExtensionCompositeTreeNode)
        : (node.parent as ExtensionCompositeTreeNode);

    if (this.potentialParent !== newPotentialParent || !this.draggedOverDecoration.hasTarget(newPotentialParent)) {
      if (this.potentialParent) {
        this.draggedOverDecoration.removeTarget(this.potentialParent);
      }
      this.potentialParent = newPotentialParent;
      this.draggedOverDecoration.addTarget(this.potentialParent, TargetMatchMode.SelfAndChildren);
      // 通知视图更新
      this.treeModel.dispatchChange();
    }

    if (this.potentialParent !== node && ExtensionCompositeTreeNode.is(node)) {
      this.dragOverTrigger.trigger(async () => {
        if (!node.expanded) {
          await (node as ExtensionCompositeTreeNode).setExpanded(true);
          // 确保当前仍在当前拖区域节点中
          if (this.draggedOverNode === node) {
            if (this.potentialParent) {
              this.draggedOverDecoration.removeTarget(this.potentialParent);
            }
            this.potentialParent = node as ExtensionCompositeTreeNode;
            this.draggedOverDecoration.addTarget(this.potentialParent, TargetMatchMode.SelfAndChildren);
          }
        } else {
          if (this.potentialParent) {
            this.draggedOverDecoration.removeTarget(this.potentialParent);
          }
          this.potentialParent = node as ExtensionCompositeTreeNode;
          this.draggedOverDecoration.addTarget(this.potentialParent, TargetMatchMode.SelfAndChildren);
        }
        // 通知视图更新
        this.treeModel.dispatchChange();
      });
      this.toCancelNodeExpansion.push(
        Disposable.create(() => {
          if (!this.dragOverTrigger.isTriggered()) {
            this.dragOverTrigger.cancel();
          }
        }),
      );
    }
  };

  handleDragLeave = (event: DragEvent, _node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    event.preventDefault();
    event.stopPropagation();
    this.toCancelNodeExpansion.dispose();
    // Clear draggedOver decoration after leave
    if (this.potentialParent) {
      this.draggedOverDecoration.removeTarget(this.potentialParent);
      // Update view
      this.treeModel.dispatchChange();
    }
  };

  handleDragEnd = (event: DragEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    // Check if the drag was cancelled.
    if (event.dataTransfer?.dropEffect === 'none') {
      this.dragCancellationToken?.cancel();
    }
    this.draggingDecoration.removeTarget(node);
    if (this.potentialParent) {
      this.draggedOverDecoration.removeTarget(this.potentialParent);
    }
    this.beingDraggedNodes.forEach((node) => {
      // Remove dragging decoration
      this.draggingDecoration.removeTarget(node);
    });
    this.beingDraggedNodes = [];
    this.potentialParent = null;
    // Update view
    this.treeModel.dispatchChange();
    if (!this.toCancelNodeExpansion.disposed) {
      this.toCancelNodeExpansion.dispose();
    }
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
    // 选中的节点不是选中状态时，默认先更新节点为选中状态
    // 后续点击切换焦点状态
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
    // 单选操作默认先更新选中状态
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
        // 单击事件
        // 200ms内多次点击默认为双击事件
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

  handleContextMenu = (ev: MouseEvent, item?: ExtensionCompositeTreeNode | ExtensionTreeNode) => {
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
      // 空白区域右键菜单
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
        // 当Tree为空时，刷新一次Tree
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
      // 递归展开几层节点，最多三层
      let expand = Math.min(isNumber(options.expand) ? options.expand : options.expand === true ? 1 : 0, 3);

      let itemsToExpand = await this.extensionTreeHandle.ensureVisible(cache.path);
      if (itemsToExpand) {
        if (select) {
          // 更新节点选中态，不会改变焦点态节点
          this.selectNodeDecoration(itemsToExpand as ExtensionTreeNode);
        }
        if (focus) {
          // 给节点焦点样式并更新当前选中态
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
