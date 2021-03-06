import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  DecorationsManager,
  Decoration,
  IRecycleTreeHandle,
  TreeNodeType,
  WatchEvent,
  TreeNodeEvent,
  IWatcherEvent,
  CompositeTreeNode,
} from '@opensumi/ide-components';
import {
  Emitter,
  IContextKeyService,
  Deferred,
  Event,
  DisposableCollection,
  IClipboardService,
  path,
  pSeries,
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';

import { IDebugSessionManager } from '../../../common';
import { LinkDetector } from '../../debug-link-detector';
import { DebugSession } from '../../debug-session';
import { DidChangeActiveDebugSession } from '../../debug-session-manager';
import { AnsiConsoleNode } from '../../tree';
import {
  ExpressionContainer,
  ExpressionNode,
  DebugConsoleNode,
  DebugConsoleRoot,
} from '../../tree/debug-tree-node.define';
import { DebugViewModel } from '../debug-view-model';

import { DebugContextKey } from './../../contextkeys/debug-contextkey.service';
import { DebugConsoleTreeModel } from './debug-console-model';
import { DebugConsoleSession } from './debug-console-session';
import styles from './debug-console.module.less';

const { Path } = path;
export interface IDebugConsoleHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export interface IDebugConsoleModel {
  treeModel: DebugConsoleTreeModel;
  debugConsoleSession: DebugConsoleSession;
}

@Injectable()
export class DebugConsoleModelService {
  private static DEFAULT_REFRESH_DELAY = 200;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IDebugSessionManager)
  protected readonly manager: IDebugSessionManager;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  @Autowired(LinkDetector)
  private readonly linkDetector: LinkDetector;

  @Autowired(DebugContextKey)
  private readonly debugContextKey: DebugContextKey;

  private _activeDebugSessionModel: IDebugConsoleModel | undefined;
  private debugSessionModelMap: Map<string, IDebugConsoleModel> = new Map();

  private _decorations: DecorationsManager;
  private _debugWatchTreeHandle: IDebugConsoleHandle;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];

  // ?????????
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // ?????????
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // ?????????????????????
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // ?????????
  // ???????????????????????????????????????
  private _focusedNode: AnsiConsoleNode | DebugConsoleNode | undefined;
  // ??????????????????
  private _selectedNodes: (AnsiConsoleNode | DebugConsoleNode)[] = [];
  // ??????????????????????????????
  private _contextMenuNode: AnsiConsoleNode | DebugConsoleNode | undefined;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelEmitter: Emitter<IDebugConsoleModel | void> = new Emitter();

  // ??????????????????ContextKeyService
  private _contextMenuContextKeyService: IContextKeyService;

  private treeModelDisposableCollection: DisposableCollection = new DisposableCollection();
  private debugConsoleDisposableCollection: DisposableCollection = new DisposableCollection();

  constructor() {
    this.init();
  }

  get flushEventQueuePromise() {
    return this.flushEventQueueDeferred && this.flushEventQueueDeferred.promise;
  }

  get contextMenuContextKeyService() {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  get treeHandle() {
    return this._debugWatchTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._activeDebugSessionModel?.treeModel;
  }

  get debugConsoleSession() {
    return this._activeDebugSessionModel?.debugConsoleSession;
  }

  // ???????????????????????????????????????
  get focusedNode() {
    return this._focusedNode;
  }

  // ?????????????????????????????????
  get selectedNodes() {
    return this._selectedNodes;
  }

  // ??????????????????????????????
  get contextMenuNode() {
    return this._contextMenuNode;
  }

  get onDidUpdateTreeModel(): Event<IDebugConsoleModel | void> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  clear = () => {
    // ???????????????Console????????????TreeModel
    this.initTreeModel(this.manager.currentSession, true);
  };

  collapseAll = () => {
    this.treeModel?.root.collapsedAll();
  };

  copyAll = () => {
    let text = '';
    if (!this.treeModel?.root || !this.treeModel.root.children) {
      return;
    }
    for (const child of this.treeModel.root.children) {
      text += this.getValidText(child as DebugConsoleNode) + '\n';
    }
    this.clipboardService.writeText(text.slice(0, -'\n'.length));
  };

  copy = (node: DebugConsoleNode) => {
    if (node) {
      this.clipboardService.writeText(this.getValidText(node));
    }
  };

  private getValidText(node: DebugConsoleNode) {
    return node.description;
  }

  getConsoleModel(id: string): IDebugConsoleModel | undefined {
    return this.debugSessionModelMap.get(id);
  }

  dispose() {
    this.disposeTreeModel();
    this.disposeDebugConsole();
  }

  disposeTreeModel() {
    if (!this.treeModelDisposableCollection.disposed) {
      this.treeModelDisposableCollection.dispose();
    }
  }

  disposeDebugConsole() {
    if (!this.debugConsoleDisposableCollection.disposed) {
      this.debugConsoleDisposableCollection.dispose();
    }
  }

  async init() {
    this.debugConsoleDisposableCollection.push(
      this.manager.onDidDestroyDebugSession((session: DebugSession) => {
        this.debugSessionModelMap.delete(session.id);
        if (this.debugSessionModelMap.size > 0) {
          this.initTreeModel(this.manager.currentSession);
        }
      }),
    );
    this.debugConsoleDisposableCollection.push(
      this.manager.onDidChangeActiveDebugSession((state: DidChangeActiveDebugSession) => {
        if (state.current) {
          this.initTreeModel(state.current);
        }
      }),
    );
  }

  listenTreeViewChange() {
    this.disposeTreeModel();
    this.treeModelDisposableCollection.push(
      this.treeModel?.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
        this.loadingDecoration.addTarget(target);
      }),
    );
    this.treeModelDisposableCollection.push(
      this.treeModel?.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
      }),
    );
    this.treeModelDisposableCollection.push(
      this.treeModel!.onWillUpdate(() => {
        // ?????????????????????????????????
        if (this.selectedNodes.length !== 0) {
          // ???????????????????????????
          const node = this.treeModel?.root.getTreeNodeByPath(this.selectedNodes[0].path);
          this.selectedDecoration.addTarget(node as ExpressionNode);
        }
      }),
    );
  }

  async initTreeModel(session?: DebugSession, force?: boolean) {
    if (!session) {
      this._activeDebugSessionModel = undefined;
      this.onDidUpdateTreeModelEmitter.fire(this._activeDebugSessionModel);
      return;
    }
    // ?????? IDebugSessionReplMode ????????? session ?????????????????? session ??? repl
    const sessionId = session.hasSeparateRepl() ? session.id : session.parentSession!.id;

    if (this.debugSessionModelMap.has(sessionId) && !force) {
      const model = this.debugSessionModelMap.get(sessionId);
      this._activeDebugSessionModel = model;
    } else {
      // ????????????????????????????????????????????????
      const root = new DebugConsoleRoot({} as any);
      if (!root) {
        return;
      }
      const treeModel = this.injector.get<any>(DebugConsoleTreeModel, [root]);
      const debugConsoleSession = this.injector.get<any>(DebugConsoleSession, [
        session,
        treeModel,
      ]) as DebugConsoleSession;
      this._activeDebugSessionModel = {
        treeModel,
        debugConsoleSession,
      };
      debugConsoleSession.onDidChange(async () => {
        if (!treeModel) {
          return;
        }
        const branchSize = (treeModel.root as DebugConsoleRoot).branchSize;
        const children = debugConsoleSession.resolveChildren();
        (treeModel.root as DebugConsoleRoot).updatePresetChildren(children);
        if (branchSize === children.length) {
          return;
        } else {
          this.refresh();
        }
        if (treeModel.isScrollBottom) {
          await this.treeHandle.ensureVisible(children[children.length - 1]);
        }
        treeModel?.dispatchChange();
      });
      this.debugSessionModelMap.set(sessionId, this._activeDebugSessionModel);
      this.initDecorations(root);
      this.listenTreeViewChange();
    }
    this.onDidUpdateTreeModelEmitter.fire(this._activeDebugSessionModel);
    return this._activeDebugSessionModel;
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // ??????????????????/??????????????????????????????????????????
  activeNodeDecoration = (target: AnsiConsoleNode | DebugConsoleNode, dispatchChange = true) => {
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
      }
      this.selectedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      if (dispatchChange) {
        // ??????????????????
        this.treeModel?.dispatchChange();
      }
    }
  };

  // ???????????????????????????
  activeNodeActivedDecoration = (target: AnsiConsoleNode | DebugConsoleNode) => {
    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
    }
    if (this.focusedNode) {
      this._focusedNode = undefined;
    }
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuNode = target;
    this.treeModel?.dispatchChange();
  };

  // ????????????????????????
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this._focusedNode = undefined;
    }
    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
    }
    this.treeModel?.dispatchChange();
  };

  removeNodeDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.contextMenuDecoration);
    this.decorations.removeDecoration(this.loadingDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, expression?: AnsiConsoleNode | DebugConsoleNode) => {
    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;
    this.debugContextKey.contextInDebugConsole.set(true);

    if (expression) {
      this.activeNodeActivedDecoration(expression);
    } else {
      this.enactiveNodeDecoration();
    }
    let node: AnsiConsoleNode | DebugConsoleNode;

    if (!expression) {
      // ????????????????????????
      node = this.treeModel?.root as DebugConsoleNode;
    } else {
      node = expression;
    }
    const menus = this.contextMenuService.createMenu({
      id: MenuId.DebugConsoleContext,
      contextKeyService: this.debugContextKey.contextKeyScoped,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [node],
      onHide: () => {
        window.requestAnimationFrame(() => {
          this.debugContextKey.contextInDebugConsole.set(false);
        });
      },
    });
  };

  handleTreeHandler(handle: IDebugConsoleHandle) {
    this._debugWatchTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // ??????????????????
    this.enactiveNodeDecoration();
  };

  handleItemClick = (item: AnsiConsoleNode | DebugConsoleNode) => {
    // ???????????????????????????????????????
    this.activeNodeDecoration(item);
  };

  handleTwistierClick = (item: AnsiConsoleNode | DebugConsoleNode, type: TreeNodeType) => {
    if (type === TreeNodeType.CompositeTreeNode) {
      if (DebugConsoleNode.is(item) && (item as DebugConsoleNode).available) {
        this.activeNodeDecoration(item, false);
        this.toggleDirectory(item as ExpressionContainer);
        return;
      } else {
        if ((item as ExpressionContainer).variablesReference) {
          this.activeNodeDecoration(item, false);
          this.toggleDirectory(item as ExpressionContainer);
          return;
        }
      }
    }
    this.activeNodeDecoration(item);
  };

  toggleDirectory = async (item: ExpressionContainer) => {
    if (item.expanded) {
      this.treeHandle.collapseNode(item);
    } else {
      this.treeHandle.expandNode(item);
    }
  };

  private dispatchWatchEvent(root: DebugConsoleRoot, path: string, event: IWatcherEvent) {
    const watcher = root.watchEvents.get(path);
    if (watcher && watcher.callback) {
      watcher.callback(event);
    }
  }

  collapsedAll() {
    this.treeModel?.root.collapsedAll();
  }

  /**
   * ?????????????????????????????????
   */
  async refresh(node?: ExpressionContainer) {
    if (!node) {
      if (this.treeModel) {
        node = this.treeModel.root as ExpressionContainer;
      } else {
        return;
      }
    }
    if (!ExpressionContainer.is(node) && (node as ExpressionContainer).parent) {
      node = (node as ExpressionContainer).parent as ExpressionContainer;
    }
    // ???????????????????????????node.refresh????????????????????????????????????????????????
    // ???????????????????????????????????????
    this.queueChangeEvent(node.path, () => {
      this.onDidRefreshedEmitter.fire();
    });
  }

  // ?????????Changed??????
  private queueChangeEvent(path: string, callback: any) {
    if (!this.flushEventQueueDeferred) {
      this.flushEventQueueDeferred = new Deferred<void>();
      clearTimeout(this._eventFlushTimeout);
      this._eventFlushTimeout = setTimeout(async () => {
        await this.flushEventQueue()!;
        this.flushEventQueueDeferred?.resolve();
        this.flushEventQueueDeferred = null;
        callback();
      }, DebugConsoleModelService.DEFAULT_REFRESH_DELAY) as any;
    }
    if (this._changeEventDispatchQueue.indexOf(path) === -1) {
      this._changeEventDispatchQueue.push(path);
    }
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
        const node = this.treeModel?.root?.getTreeNodeByPath(path);
        if (node && CompositeTreeNode.is(node)) {
          await (node as CompositeTreeNode).refresh();
        }
        return null;
      }),
    );
    // ??????????????????
    this._changeEventDispatchQueue = [];
    return promise;
  };

  async execute(value: string) {
    if (!this.treeModel) {
      return;
    }
    const parent: DebugConsoleRoot = this.treeModel.root as DebugConsoleRoot;
    const textNode = new AnsiConsoleNode(value, parent, this.linkDetector);
    this.dispatchWatchEvent(parent, parent.path, { type: WatchEvent.Added, node: textNode, id: parent.id });
    const expressionNode = new DebugConsoleNode(this.manager.currentSession, value, parent as ExpressionContainer);
    await expressionNode.evaluate();
    this.dispatchWatchEvent(parent, parent.path, { type: WatchEvent.Added, node: expressionNode, id: parent.id });
    this.treeHandle.ensureVisible(expressionNode, 'end', true);
  }
}
