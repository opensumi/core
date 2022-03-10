import pSeries from 'p-series';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  TreeModel,
  DecorationsManager,
  Decoration,
  IRecycleTreeHandle,
  TreeNodeType,
  WatchEvent,
  TreeNodeEvent,
  NewPromptHandle,
  IWatcherEvent,
  RenamePromptHandle,
} from '@opensumi/ide-components';
import {
  Emitter,
  IContextKeyService,
  ThrottledDelayer,
  Deferred,
  Event,
  DisposableCollection,
  StorageProvider,
  STORAGE_NAMESPACE,
  IClipboardService,
  IContextKey,
  IReporterService,
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { Path } from '@opensumi/ide-core-common/lib/path';

import { DebugSessionManager } from '../../debug-session-manager';
import { DebugWatch } from '../../model';
import { ExpressionContainer, ExpressionNode, DebugWatchNode, DebugWatchRoot } from '../../tree/debug-tree-node.define';
import { DebugViewModel } from '../debug-view-model';

import { CONTEXT_WATCH_EXPRESSIONS_FOCUSED, CONTEXT_WATCH_ITEM_TYPE } from './../../../common/constants';
import { IDebugSessionManager } from './../../../common/debug-session';
import { DebugVariableContainer, DebugVariable } from './../../tree/debug-tree-node.define';
import { DebugWatchModel } from './debug-watch-model';
import styles from './debug-watch.module.less';


export interface IDebugWatchHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export type IWatchNode = DebugVariable | DebugVariableContainer | DebugWatchNode | DebugWatchRoot;

@Injectable()
export class DebugWatchModelService {
  private static DEFAULT_REFRESH_DELAY = 100;
  private static DEFAULT_TRIGGER_DELAY = 200;

  private static DEBUG_WATCHER_EXPRESSIONS_STORAGE_KEY = 'watchers';

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  @Autowired(IReporterService)
  protected readonly reporterService: IReporterService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  private _activeTreeModel: DebugWatchModel | undefined;

  private _decorations: DecorationsManager;
  private _debugWatchTreeHandle: IDebugWatchHandle;
  private debugWatch: DebugWatch;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  // 即使选中态也是焦点态的节点
  private _focusedNode: IWatchNode | undefined;
  // 选中态的节点
  private _selectedNodes: IWatchNode[] = [];
  // 右键菜单选中态的节点
  private _contextMenuNode: IWatchNode | undefined;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelEmitter: Emitter<TreeModel | void> = new Emitter();

  // 右键菜单局部ContextKeyService
  private _contextMenuContextKeyService: IContextKeyService;

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(DebugWatchModelService.DEFAULT_TRIGGER_DELAY);

  private disposableCollection: DisposableCollection = new DisposableCollection();
  private loadedDeferred: Deferred<void> = new Deferred();

  private watchItemType: IContextKey<string>;

  constructor() {
    this.debugWatch = new DebugWatch(this.manager, this.reporterService);

    this.init();
    this.watchItemType = CONTEXT_WATCH_ITEM_TYPE.bind(this.contextKeyService);
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
    return this._activeTreeModel;
  }

  // 既是选中态，也是焦点态节点
  get focusedNode() {
    return this._focusedNode;
  }

  // 是选中态，非焦点态节点
  get selectedNodes() {
    return this._selectedNodes;
  }

  // 右键菜单激活态的节点
  get contextMenuNode() {
    return this._contextMenuNode;
  }

  get onDidUpdateTreeModel(): Event<TreeModel | void> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  dispose() {
    if (!this.disposableCollection.disposed) {
      this.disposableCollection.dispose();
    }
  }

  async save(expressions: string[] = []) {
    const storage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    await storage.set(DebugWatchModelService.DEBUG_WATCHER_EXPRESSIONS_STORAGE_KEY, expressions);
  }

  async load() {
    const storage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    const data = await storage.get<string[]>(DebugWatchModelService.DEBUG_WATCHER_EXPRESSIONS_STORAGE_KEY, []);
    await this.debugWatch.updateWatchExpressions(data);
    this.loadedDeferred.resolve();
  }

  async init() {
    await this.loadedDeferred.promise;
    this.initTreeModel();
    this.listenDebugWatchChange();
  }

  listenDebugWatchChange() {
    this.debugWatch.onDidChange(async () => {
      this.flushDispatchChangeDelayer.cancel();
      this.flushDispatchChangeDelayer.trigger(async () => {
        this.initTreeModel();
      });
    });
    this.debugWatch.onDidVariableChange(async () => {
      this.refresh();
    });
    this.debugWatch.onDidExpressionChange((expressions: string[]) => {
      this.save(expressions);
    });
  }

  listenTreeViewChange() {
    this.dispose();
    this.disposableCollection.push(
      this.treeModel?.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
        this.loadingDecoration.addTarget(target);
      }),
    );
    this.disposableCollection.push(
      this.treeModel?.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
      }),
    );
    this.disposableCollection.push(
      this.treeModel!.onWillUpdate(() => {
        // 更新树前更新下选中节点
        if (this.selectedNodes.length !== 0) {
          // 仅处理一下单选情况
          const node = this.treeModel?.root.getTreeNodeByPath(this.selectedNodes[0].path);
          this.selectedDecoration.addTarget(node as ExpressionNode);
        }
      }),
    );
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = await this.debugWatch.getRoot();
    if (!root) {
      return;
    }
    this._activeTreeModel = this.injector.get<any>(DebugWatchModel, [root]);

    this.initDecorations(root);
    this.listenTreeViewChange();
    this.onDidUpdateTreeModelEmitter.fire(this._activeTreeModel);
    return this._activeTreeModel;
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: IWatchNode, dispatchChange = true) => {
    CONTEXT_WATCH_EXPRESSIONS_FOCUSED.bind(this.contextKeyService);
    if (this.contextMenuNode) {
      this.focusedDecoration.removeTarget(this.contextMenuNode);
      this.selectedDecoration.removeTarget(this.contextMenuNode);
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

      if (dispatchChange) {
        // 通知视图更新
        this.treeModel?.dispatchChange();
      }
    }
  };

  // 右键菜单焦点态切换
  activeNodeActivedDecoration = (target: IWatchNode) => {
    if (this.contextMenuNode) {
      this.contextMenuDecoration.removeTarget(this.contextMenuNode);
    }
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this._focusedNode = undefined;
    }
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuNode = target;
    this.treeModel?.dispatchChange();
  };

  // 取消选中节点焦点
  enactiveNodeDecoration = () => {
    CONTEXT_WATCH_EXPRESSIONS_FOCUSED.bind(this.contextKeyService).set(false);
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
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
    this.decorations.removeDecoration(this.focusedDecoration);
    this.decorations.removeDecoration(this.contextMenuDecoration);
    this.decorations.removeDecoration(this.loadingDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, expression?: IWatchNode) => {
    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;

    if (expression) {
      this.activeNodeActivedDecoration(expression);
    } else {
      this.enactiveNodeDecoration();
    }
    let node: IWatchNode | ExpressionContainer;

    if (!expression) {
      // 空白区域右键菜单
      node = this.treeModel?.root as ExpressionContainer;
    } else {
      node = expression;
    }

    this.watchItemType.set(
      node instanceof DebugWatchNode
        ? 'expression'
        : node instanceof DebugVariable || node instanceof DebugVariableContainer
        ? 'variable'
        : undefined,
    );

    const menus = this.contextMenuService.createMenu({
      id: MenuId.DebugWatchContext,
      contextKeyService: this.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [node],
    });
  };

  handleTreeHandler(handle: IDebugWatchHandle) {
    this._debugWatchTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveNodeDecoration();
  };

  handleItemClick = (item: IWatchNode) => {
    // 单选操作默认先更新选中状态
    this.activeNodeDecoration(item);
  };

  handleTwistierClick = (item: IWatchNode, type: TreeNodeType) => {
    if (type === TreeNodeType.CompositeTreeNode) {
      if (DebugWatchNode.is(item) && (item as DebugWatchNode).available) {
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

  async newDebugWatchNodePrompt() {
    if (this.treeModel) {
      this.proxyPrompt(await this.treeHandle.promptNewTreeNode(this.treeModel.root));
    }
  }

  async renameDebugWatchNodePrompt(node: DebugWatchNode) {
    if (this.treeModel) {
      this.proxyPrompt(await this.treeHandle.promptRename(node));
    }
  }

  removeDebugWatchNode(node: DebugWatchNode) {
    this.debugWatch.removeWatchExpression(node.name);
    if (node.session) {
      this.initTreeModel();
    } else {
      this.dispatchWatchEvent(node.parent!.path, { type: WatchEvent.Removed, path: node.path });
    }
  }

  async copyValue(node: DebugWatchNode) {
    const value = await node.getClipboardValue();
    if (value) {
      await this.clipboardService.writeText(value);
    }
  }

  async clearAllExpression() {
    this.debugWatch.updateWatchExpressions([]);
    await this.initTreeModel();
    this.save();
  }

  public addWatchExpression(expression: string): void {
    this.debugWatch.addWatchExpression(expression);
    this.initTreeModel();
  }

  private dispatchWatchEvent(path: string, event: IWatcherEvent) {
    const watcher = this.treeModel?.root.watchEvents.get(path);
    if (watcher && watcher.callback) {
      watcher.callback(event);
    }
  }

  private proxyPrompt = (promptHandle: NewPromptHandle | RenamePromptHandle) => {
    let isCommitting = false;
    const commit = async (expression: string) => {
      if (isCommitting) {
        return;
      }
      isCommitting = true;
      if (expression) {
        if (promptHandle instanceof NewPromptHandle) {
          const parent = promptHandle.parent as DebugWatchRoot;
          promptHandle.addAddonAfter('loading_indicator');
          if (parent.session) {
            this.addWatchExpression(expression);
          } else {
            const node = new DebugWatchNode(parent.session, expression, parent);
            this.dispatchWatchEvent(parent.path, { type: WatchEvent.Added, node, id: parent.id });
            this.debugWatch.addWatchExpression(expression);
          }
        } else if (promptHandle instanceof RenamePromptHandle) {
          const target = promptHandle.target;
          const parent = target.parent as DebugWatchRoot;
          promptHandle.addAddonAfter('loading_indicator');
          if (parent.session) {
            this.debugWatch.renameWatchExpression(target.name, expression);
            this.initTreeModel();
          } else {
            const newPath = new Path(target.path).dir.join(expression).toString();
            this.dispatchWatchEvent(parent.path, { type: WatchEvent.Moved, oldPath: target.path, newPath });
            this.debugWatch.renameWatchExpression(target.name, expression);
          }
        }
      }
      return true;
    };

    if (!promptHandle.destroyed) {
      promptHandle.onCommit(commit);
      promptHandle.onBlur(commit);
    }
  };

  collapsedAll() {
    this.treeModel?.root.collapsedAll();
  }

  /**
   * 刷新指定下的所有子节点
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
    // 这里也可以直接调用node.refresh，但由于文件树刷新事件可能会较多
    // 队列化刷新动作减少更新成本
    this.queueChangeEvent(node.path, () => {
      this.onDidRefreshedEmitter.fire();
    });
  }

  // 队列化Changed事件
  private queueChangeEvent(path: string, callback: any) {
    if (!this.flushEventQueueDeferred) {
      this.flushEventQueueDeferred = new Deferred<void>();
      clearTimeout(this._eventFlushTimeout);
      this._eventFlushTimeout = setTimeout(async () => {
        await this.flushEventQueue()!;
        this.flushEventQueueDeferred?.resolve();
        this.flushEventQueueDeferred = null;
        callback();
      }, DebugWatchModelService.DEFAULT_REFRESH_DELAY) as any;
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
        const watcher = this.treeModel?.root?.watchEvents.get(path);
        if (watcher && typeof watcher.callback === 'function') {
          await watcher.callback({ type: WatchEvent.Changed, path });
        }
        return null;
      }),
    );
    // 重置更新队列
    this._changeEventDispatchQueue = [];
    return promise;
  };
}
