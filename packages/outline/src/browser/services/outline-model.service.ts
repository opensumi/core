import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, WatchEvent } from '@opensumi/ide-components';
import {
  URI,
  DisposableCollection,
  Emitter,
  CommandService,
  Deferred,
  Event,
  MaybeNull,
  MarkerManager,
  IPosition,
  IRange,
  Disposable,
  ThrottledDelayer,
  path,
  pSeries,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import {
  DocumentSymbolStore,
  INormalizedDocumentSymbol,
} from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';
import { EXPLORER_CONTAINER_ID } from '@opensumi/ide-explorer/lib/browser/explorer-contribution';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IOutlineDecorationService, OUTLINE_VIEW_ID } from '../../common';
import { OutlineTreeNode, OutlineCompositeTreeNode, OutlineRoot } from '../outline-node.define';
import styles from '../outline-node.module.less';

import { OutlineEventService } from './outline-event.service';
import { OutlineTreeModel } from './outline-model';
import { OutlineTreeService } from './outline-tree.service';

const { Path } = path;

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class OutlineModelService {
  private static DEFAULT_REFRESH_DELAY = 200;
  private static DEFAULT_INIT_TREE_MODEL_DELAY = 500;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(OutlineTreeService)
  private readonly outlineTreeService: OutlineTreeService;

  @Autowired(MarkerManager)
  private markerManager: MarkerManager;

  @Autowired(IOutlineDecorationService)
  public decorationService: IOutlineDecorationService;

  @Autowired(OutlineEventService)
  public readonly outlineEventService: OutlineEventService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(CommandService)
  public readonly commandService: CommandService;

  @Autowired(DocumentSymbolStore)
  private documentSymbolStore: DocumentSymbolStore;

  @Autowired(IMainLayoutService)
  private readonly mainLayoutService: IMainLayoutService;

  private _activeTreeModel: OutlineTreeModel;
  private _allTreeModels: Map<string, { treeModel: OutlineTreeModel; decoration: DecorationsManager }> = new Map();
  private _whenInitTreeModelReady: Promise<void>;
  private _whenActiveChangeDeferred: Deferred<void> | null;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _outlineTreeHandle: IEditorTreeHandle;

  private refreshDeferred: Deferred<void> | null;
  private _changeEventDispatchQueue: string[] = [];

  // ?????????
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // ?????????
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // ?????????
  private dirtyDecoration: Decoration = new Decoration(styles.mod_dirty); // ?????????
  // ???????????????????????????????????????
  private _focusedNode: OutlineCompositeTreeNode | OutlineTreeNode | undefined;
  // ??????????????????
  private _selectedNodes: (OutlineCompositeTreeNode | OutlineTreeNode)[] = [];

  private preContextMenuFocusedNode: OutlineCompositeTreeNode | OutlineTreeNode | null;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelEmitter: Emitter<OutlineTreeModel | undefined> = new Emitter();

  private _ignoreFollowCursorUpdateEventTimer = 0;
  private initTreeModelDelayer: ThrottledDelayer<void>;
  private refreshDelayer: ThrottledDelayer<void>;

  constructor() {
    this.initTreeModelDelayer = new ThrottledDelayer(OutlineModelService.DEFAULT_INIT_TREE_MODEL_DELAY);
    this.refreshDelayer = new ThrottledDelayer(OutlineModelService.DEFAULT_REFRESH_DELAY);
    this._whenReady = this.initTreeModel();
  }

  get whenReady() {
    return this._whenReady;
  }

  get flushEventQueuePromise() {
    return this.refreshDeferred && this.refreshDeferred.promise;
  }

  get outlineTreeHandle() {
    return this._outlineTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._activeTreeModel;
  }

  // ???????????????????????????????????????
  get focusedNode() {
    return this._focusedNode;
  }
  // ?????????????????????????????????
  get selectedNodes() {
    return this._selectedNodes;
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  get onDidUpdateTreeModel(): Event<OutlineTreeModel | undefined> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get whenActiveChangeReady() {
    return this._whenActiveChangeDeferred?.promise;
  }

  get whenInitTreeModelReady() {
    return this._whenInitTreeModelReady;
  }

  get whenRefreshReady() {
    return this.refreshDeferred?.promise;
  }

  async initTreeModelByCurrentUri(uri?: URI | null) {
    await this.outlineTreeService.whenReady;
    // ???????????????????????????
    await this.refreshDeferred?.promise;
    this.outlineTreeService.currentUri = uri;
    if (!!uri && this._allTreeModels.has(uri.toString())) {
      const treeModelStore = this._allTreeModels.get(uri.toString());
      // ????????????????????????
      this._activeTreeModel = treeModelStore!.treeModel;
      this._decorations = treeModelStore!.decoration;
      this.onDidUpdateTreeModelEmitter.fire(this._activeTreeModel);
    } else if (uri) {
      // ????????????????????????????????????????????????
      const root = (await this.outlineTreeService.resolveChildren())[0];
      if (!root) {
        return;
      }
      const treeModel = this.injector.get<any>(OutlineTreeModel, [root]);
      await treeModel.root.ensureLoaded();
      this._activeTreeModel = treeModel;
      // ????????????????????????
      const decoration = this.initDecorations(root);
      if (uri) {
        this._allTreeModels.set(uri?.toString(), {
          treeModel,
          decoration,
        });
      }
      this.disposableCollection.push(
        treeModel.onWillUpdate(() => {
          if (this.focusedNode) {
            // ?????????????????????????????????
            const node = treeModel?.root.getTreeNodeById(this.focusedNode.id);
            this.activeNodeDecoration(node as OutlineTreeNode, false);
          } else if (this.selectedNodes.length !== 0) {
            // ???????????????????????????
            const node = treeModel?.root.getTreeNodeById(this.selectedNodes[0].id);
            this.selectNodeDecoration(node as OutlineTreeNode, false);
          }
        }),
      );
      this.onDidUpdateTreeModelEmitter.fire(treeModel);
    } else {
      this.onDidUpdateTreeModelEmitter.fire(undefined);
    }
  }

  async initTreeModel() {
    this._whenInitTreeModelReady = this.initTreeModelByCurrentUri(this.editorService.currentEditor?.currentUri);

    await this._whenInitTreeModelReady;

    this.disposableCollection.push(
      this.markerManager.onMarkerChanged((resources) => {
        if (
          this.outlineTreeService.currentUri &&
          resources.find((resource) => resource === this.outlineTreeService.currentUri!.toString())
        ) {
          this.refresh();
        }
      }),
    );

    this.disposableCollection.push(
      this.outlineEventService.onDidActiveChange(async () => {
        if (!this._whenActiveChangeDeferred) {
          this._whenActiveChangeDeferred = new Deferred<void>();
        }
        if (!this.initTreeModelDelayer.isTriggered()) {
          this.initTreeModelDelayer.cancel();
        }
        this.initTreeModelDelayer.trigger(async () => {
          await this._whenInitTreeModelReady;
          // ???????????????????????????????????????????????????????????????????????????
          if (!this.refreshDelayer.isTriggered()) {
            this.refreshDelayer.cancel();
          }
          const uri = this.editorService.currentEditor?.currentUri;
          this._whenInitTreeModelReady = this.initTreeModelByCurrentUri(uri);
          this._whenActiveChangeDeferred?.resolve();
          this._whenActiveChangeDeferred = null;
        });
      }),
    );

    this.disposableCollection.push(
      this.outlineEventService.onDidSelectionChange(() => {
        // ??????????????????????????????Tree????????????????????????????????????
        if (this.outlineTreeService.followCursor) {
          // ??????????????????????????????????????????????????????????????????
          this.locateSelection(false);
        }
      }),
    );

    this.disposableCollection.push(
      this.outlineEventService.onDidChange((url: URI | null) => {
        this.outlineTreeService.currentUri = this.editorService.currentEditor?.currentUri;
        this.refresh();
      }),
    );

    this.disposableCollection.push(
      this.outlineTreeService.onDidChange(() => {
        this.refresh();
      }),
    );

    this.disposableCollection.push(
      Disposable.create(() => {
        this._allTreeModels.clear();
      }),
    );
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.dirtyDecoration);
    return this._decorations;
  }

  private locateSelection(quiet = true) {
    if (!this.outlineTreeService.currentUri) {
      return;
    }
    const symbols = this.documentSymbolStore.getDocumentSymbol(this.outlineTreeService.currentUri!);
    if (symbols) {
      const activeSymbols = this.findCurrentDocumentSymbol(
        symbols,
        this.editorService.currentEditorGroup.codeEditor.monacoEditor.getPosition(),
      );
      const node = this.outlineTreeService.getTreeNodeBySymbol(activeSymbols[activeSymbols.length - 1]);
      if (node) {
        if (this._ignoreFollowCursorUpdateEventTimer) {
          this._ignoreFollowCursorUpdateEventTimer--;
          return;
        } else {
          this.location(node as OutlineTreeNode);
        }
        this.activeNodeDecoration(node as OutlineTreeNode, !quiet);
      }
    }
  }

  private findCurrentDocumentSymbol(
    documentSymbols: INormalizedDocumentSymbol[],
    position: MaybeNull<IPosition>,
  ): INormalizedDocumentSymbol[] {
    const result: INormalizedDocumentSymbol[] = [];
    if (!position) {
      return result;
    }
    let toFindIn: INormalizedDocumentSymbol[] | undefined = documentSymbols;
    while (toFindIn && toFindIn.length > 0) {
      let found = false;
      for (const documentSymbol of toFindIn) {
        if (this.positionInRange(position, documentSymbol.range)) {
          result.push(documentSymbol);
          toFindIn = documentSymbol.children;
          found = true;
          break;
        }
      }
      if (!found) {
        break;
      }
    }
    return result;
  }

  private positionInRange(pos: IPosition, range: IRange): boolean {
    if (pos.lineNumber < range.startLineNumber) {
      return false;
    } else if (pos.lineNumber === range.startLineNumber) {
      return pos.column >= range.startColumn;
    } else if (pos.lineNumber < range.endLineNumber) {
      return true;
    } else if (pos.lineNumber === range.endLineNumber) {
      return pos.column <= range.endColumn;
    } else {
      return false;
    }
  }
  // ???????????????????????????
  clearNodeSelectedDecoration = () => {
    this._selectedNodes.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedNodes = [];
  };

  // ??????????????????/??????????????????????????????????????????
  activeNodeDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode, dispatch = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.preContextMenuFocusedNode = null;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.selectedNodes.forEach((file) => {
          // ?????????????????????????????????????????????????????????????????????selectedNodes?????????
          // ?????????????????????????????????????????????????????????????????????
          for (const target of this.selectedDecoration.appliedTargets.keys()) {
            this.selectedDecoration.removeTarget(target);
          }
        });
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      // ??????????????????
      dispatch && this.treeModel?.dispatchChange();
    }
  };

  // ??????????????????/??????????????????????????????????????????
  selectNodeDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode, dispatch = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.selectedNodes.forEach((node) => {
          this.selectedDecoration.removeTarget(node);
        });
      }
      if (this.focusedNode) {
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      this.selectedDecoration.addTarget(target);
      this._selectedNodes = [target];

      // ??????????????????
      dispatch && this.treeModel?.dispatchChange();
    }
  };

  // ?????????????????????????????????????????????????????????
  // removePreFocusedDecoration ??????????????????????????????????????????????????????????????????????????????????????????????????????
  activeNodeFocusedDecoration = (
    target: OutlineCompositeTreeNode | OutlineTreeNode,
    removePreFocusedDecoration = false,
  ) => {
    if (this.focusedNode !== target) {
      if (removePreFocusedDecoration) {
        // ????????????????????????????????????????????????????????????????????????????????????????????????????????????
        if (this.preContextMenuFocusedNode) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
        } else if (this.focusedNode) {
          // ??????????????????????????????????????????
          this.focusedDecoration.removeTarget(this.focusedNode);
        }
        this.preContextMenuFocusedNode = target;
      } else if (this.focusedNode) {
        this.preContextMenuFocusedNode = null;
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedNode = target;
        this._selectedNodes.push(target);
      }
    }
    // ??????????????????
    this.treeModel?.dispatchChange();
  };

  // ????????????????????????????????????????????????
  activeNodeSelectedDecoration = (target: OutlineCompositeTreeNode | OutlineTreeNode) => {
    if (this._selectedNodes.indexOf(target) > -1) {
      return;
    }
    if (this.selectedNodes.length > 0) {
      this.selectedNodes.forEach((file) => {
        this.selectedDecoration.removeTarget(file);
      });
    }
    this._selectedNodes = [target];
    this.selectedDecoration.addTarget(target);
    // ??????????????????
    this.treeModel?.dispatchChange();
  };

  // ????????????????????????
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel?.dispatchChange();
    }
    this._focusedNode = undefined;
  };

  removeNodeDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleTreeHandler(handle: IEditorTreeHandle) {
    this._outlineTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // ??????????????????
    this.enactiveNodeDecoration();
  };

  handleItemClick = (item: OutlineCompositeTreeNode | OutlineTreeNode, type: TreeNodeType) => {
    // ???????????????????????????????????????
    this.activeNodeDecoration(item);

    this.revealRange(item.raw);

    this._ignoreFollowCursorUpdateEventTimer++;
  };

  toggleDirectory = async (item: OutlineCompositeTreeNode) => {
    if (item.expanded) {
      this.outlineTreeHandle.collapseNode(item);
    } else {
      this.outlineTreeHandle.expandNode(item);
    }
  };

  protected revealRange(symbol: INormalizedDocumentSymbol) {
    const currentEditor = this.editorService.currentEditorGroup.codeEditor;
    currentEditor.monacoEditor.revealLineInCenter(symbol.range.startLineNumber);
    currentEditor.monacoEditor.setPosition(
      new monaco.Position(symbol.range.startLineNumber, symbol.range.endLineNumber),
    );
  }

  /**
   * ?????????????????????????????????
   */
  async refresh() {
    await this.whenActiveChangeReady;
    await this.whenInitTreeModelReady;
    await this.whenRefreshReady;

    const node: OutlineRoot = this.treeModel?.root as OutlineRoot;

    if ((!node && this.editorService?.currentEditor?.currentUri) || !this.editorService?.currentEditor?.currentUri) {
      // 1. ???????????????????????????????????????Tree?????????????????????????????????outline???????????????????????????currentEditor?????????
      // 2. ?????????????????????URI???????????????????????????Tree
      this._whenInitTreeModelReady = this.initTreeModelByCurrentUri(this.editorService?.currentEditor?.currentUri);
      return;
    }

    if (!this.refreshDelayer.isTriggered()) {
      this.refreshDelayer.cancel();
    }

    return this.refreshDelayer.trigger(async () => {
      const handler = this.mainLayoutService.getTabbarHandler(EXPLORER_CONTAINER_ID);
      if (!handler || !handler.isVisible || handler.isCollapsed(OUTLINE_VIEW_ID)) {
        if (this.refreshDeferred) {
          this.refreshDeferred.resolve();
          this.refreshDeferred = null;
        }
        return;
      }
      if (!this.refreshDeferred) {
        this.refreshDeferred = new Deferred<void>();
      }
      this.outlineTreeService.currentUri = this.editorService?.currentEditor?.currentUri;
      if (
        !!node.currentUri &&
        !!this.outlineTreeService.currentUri &&
        this.outlineTreeService.currentUri.isEqual(node.currentUri)
      ) {
        // ???????????????????????????????????????
        this.decorationService.updateDiagnosisInfo(this.outlineTreeService.currentUri!);
        // ??????Outline????????????????????????????????????????????????
        await node.refresh();
        this.onDidRefreshedEmitter.fire();
      }
      this.refreshDeferred?.resolve();
      this.refreshDeferred = null;
    });
  }

  public flushEventQueue = () => {
    let promise: Promise<any>;
    if (!this._changeEventDispatchQueue || this._changeEventDispatchQueue.length === 0) {
      return;
    }
    this._changeEventDispatchQueue.sort((pathA, pathB) => {
      const pathADepth = Path.pathDepth(pathA);
      const pathBDepth = Path.pathDepth(pathB);
      return pathADepth - pathBDepth;
    });
    const roots = [this._changeEventDispatchQueue[0]];
    for (const path of this._changeEventDispatchQueue) {
      if (roots.some((root) => path.indexOf(root) === 0)) {
        continue;
      } else {
        roots.push(path);
      }
    }
    promise = pSeries(
      roots.map((path) => async () => {
        const watcher = this.treeModel.root?.watchEvents.get(path);
        if (watcher && typeof watcher.callback === 'function') {
          await watcher.callback({ type: WatchEvent.Changed, path });
        }
        return null;
      }),
    );
    // ??????????????????
    this._changeEventDispatchQueue = [];
    return promise;
  };

  public location = async (node: OutlineTreeNode) => {
    await this.refreshDeferred?.promise;
    if (!node) {
      return;
    }
    if (!this.outlineTreeHandle) {
      return;
    }
    node = (await this.outlineTreeHandle.ensureVisible(node, 'smart')) as OutlineTreeNode;
  };

  public collapseAll = async () => {
    await this.refreshDeferred?.promise;
    await this.treeModel?.root.collapsedAll();
  };

  dispose() {
    this.disposableCollection.dispose();
  }
}
