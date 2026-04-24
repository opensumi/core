import isEqual from 'lodash/isEqual';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  Decoration,
  DecorationsManager,
  IRecycleTreeHandle,
  TreeModel,
  TreeNodeEvent,
  TreeNodeType,
  WatchEvent,
} from '@opensumi/ide-components';
import {
  Deferred,
  DisposableCollection,
  Emitter,
  Event,
  IClipboardService,
  ThrottledDelayer,
  pSeries,
  path,
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { DebugSession } from '../../debug-session';
import {
  DebugScope,
  DebugVariable,
  DebugVariableContainer,
  DebugVariableRoot,
  ExpressionContainer,
  ExpressionNode,
} from '../../tree/debug-tree-node.define';
import { DebugViewModel } from '../debug-view-model';

import { DebugContextKey } from './../../contextkeys/debug-contextkey.service';
import { DebugVariablesModel } from './debug-variables-model';
import styles from './debug-variables.module.less';

const { Path } = path;

export interface IDebugVariablesHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export type DebugVariableWithRawScope = DebugScope | DebugVariableContainer;

interface IKeepExpandedScopeState {
  expandedVariables: number[];
  scopeExpanded: boolean;
}

class KeepExpandedScopesModel {
  private _keepExpandedScopesMap = new Map<DebugProtocol.Scope, IKeepExpandedScopeState>();
  constructor() {}

  private getMirrorScope(item: DebugVariableWithRawScope) {
    return Array.from(this._keepExpandedScopesMap.keys()).find((f) => isEqual(f, item.getRawScope()));
  }

  private isTopLevelScope(item: DebugVariableWithRawScope) {
    return !item.parent || DebugVariableRoot.is(item.parent as ExpressionContainer);
  }

  set(item: DebugVariableWithRawScope): void {
    const scope = item.getRawScope();
    if (scope) {
      const keepScope = this.getMirrorScope(item);
      const targetScope = keepScope || scope;
      const state = this._keepExpandedScopesMap.get(targetScope) || {
        expandedVariables: [],
        scopeExpanded: false,
      };

      if (this.isTopLevelScope(item)) {
        state.scopeExpanded = item.expanded;
      } else {
        state.expandedVariables = item.expanded
          ? Array.from(new Set([...state.expandedVariables, item.variablesReference]))
          : state.expandedVariables.filter((v) => v !== item.variablesReference);
      }

      this._keepExpandedScopesMap.set(targetScope, state);
    }
  }

  getExpandedVariables(item: DebugVariableWithRawScope): number[] {
    const keepScope = this.getMirrorScope(item);
    if (keepScope) {
      return this._keepExpandedScopesMap.get(keepScope)?.expandedVariables || [];
    } else {
      return [];
    }
  }

  isScopeExpanded(item: DebugVariableWithRawScope): boolean {
    const keepScope = this.getMirrorScope(item);
    if (keepScope) {
      return !!this._keepExpandedScopesMap.get(keepScope)?.scopeExpanded;
    }
    return false;
  }

  clear(): void {
    this._keepExpandedScopesMap.clear();
  }
}

@Injectable()
export class DebugVariablesModelService {
  private static DEFAULT_REFRESH_DELAY = 100;
  private static DEFAULT_TRIGGER_DELAY = 200;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  @Autowired(DebugContextKey)
  private readonly debugContextKey: DebugContextKey;

  private _activeTreeModel: DebugVariablesModel | undefined;

  private _decorations: DecorationsManager;
  private _debugVariablesTreeHandle: IDebugVariablesHandle;
  private _currentVariableInternalContext: DebugVariable | DebugVariableContainer | undefined;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];
  private _pendingFlushCallbacks: Array<() => Promise<void> | void> = [];
  private _isFlushingEventQueue = false;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  // 即使选中态也是焦点态的节点
  private _focusedNode: ExpressionContainer | ExpressionNode | undefined;
  // 选中态的节点
  private _selectedNodes: (ExpressionContainer | ExpressionNode)[] = [];
  // 右键菜单选中态的节点
  private _contextMenuNode: ExpressionContainer | ExpressionNode | undefined;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelEmitter: Emitter<TreeModel | void> = new Emitter();

  private flushDispatchChangeDelayer = new ThrottledDelayer<void>(DebugVariablesModelService.DEFAULT_TRIGGER_DELAY);

  private disposableCollection: DisposableCollection = new DisposableCollection();
  private currentSessionDisposableCollection: DisposableCollection = new DisposableCollection();
  private currentSession: DebugSession | undefined;

  private keepExpandedScopesModel: KeepExpandedScopesModel = new KeepExpandedScopesModel();

  constructor() {
    this.listenCurrentSessionVariableChange();
    this.listenViewModelChange();
  }

  get flushEventQueuePromise() {
    return this.flushEventQueueDeferred && this.flushEventQueueDeferred.promise;
  }

  get treeHandle() {
    return this._debugVariablesTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._activeTreeModel;
  }

  get currentVariableInternalContext() {
    return this._currentVariableInternalContext;
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
    this.disposeTreeListeners();
    if (!this.currentSessionDisposableCollection.disposed) {
      this.currentSessionDisposableCollection.dispose();
    }
  }

  private disposeTreeListeners() {
    if (!this.disposableCollection.disposed) {
      this.disposableCollection.dispose();
    }
    this.disposableCollection = new DisposableCollection();
  }

  listenViewModelChange() {
    this.viewModel.onDidChange(async () => {
      this.listenCurrentSessionVariableChange();
      if (!this.flushDispatchChangeDelayer.isTriggered()) {
        this.flushDispatchChangeDelayer.cancel();
      }
      this.flushDispatchChangeDelayer.trigger(async () => {
        if (this.viewModel && this.viewModel.currentSession && !this.viewModel.currentSession.terminated) {
          const currentTreeModel = await this.initTreeModel(this.viewModel.currentSession);
          this._activeTreeModel = currentTreeModel;
          await this._activeTreeModel?.ensureReady;
          /**
           * 如果变量面板全部都是折叠状态
           * 则需要找到当前 scope 作用域的 expensive 为 false 的变量列表，并默认展开它们
           * PS: 一般的情况下有 Local
           * */
          const scopes = (this._activeTreeModel?.root.children as Array<DebugVariableWithRawScope>) || [];
          if (scopes.length > 0 && scopes.every((s: DebugScope) => !s.expanded)) {
            for (const s of scopes) {
              if ((s as DebugScope).getRawScope().expensive === false && !s.expanded) {
                await this.toggleDirectory(s);
              }
            }
          }
          await this.restoreExpandedScopes(scopes);
        } else {
          this._activeTreeModel = undefined;
          this.keepExpandedScopesModel.clear();
        }

        this.onDidUpdateTreeModelEmitter.fire(this._activeTreeModel);
      });
    });
  }

  private listenCurrentSessionVariableChange() {
    if (this.currentSession === this.viewModel.currentSession) {
      return;
    }

    this.currentSession = this.viewModel.currentSession;
    this.currentSessionDisposableCollection.dispose();
    this.currentSessionDisposableCollection = new DisposableCollection();

    if (this.currentSession) {
      this.currentSessionDisposableCollection.push(
        this.currentSession.onVariableChange(() => {
          this.refresh();
        }),
      );
    }
  }

  listenTreeViewChange() {
    this.disposeTreeListeners();
    if (!this.treeModel) {
      return;
    }
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
  }

  async initTreeModel(session?: DebugSession) {
    // 根据是否为多工作区创建不同根节点
    const root = new DebugVariableRoot(session);
    if (!root) {
      return;
    }
    this._activeTreeModel = this.injector.get<any>(DebugVariablesModel, [root]);

    this.initDecorations(root);
    this.listenTreeViewChange();
    return this._activeTreeModel;
  }

  private isPreservedRootScope(scope: DebugVariableWithRawScope) {
    const rawScope = scope.getRawScope();
    return (
      !!rawScope &&
      (rawScope.name === 'Locals' || rawScope.name === 'Globals') &&
      (!scope.parent || DebugVariableRoot.is(scope.parent as ExpressionContainer))
    );
  }

  private async restoreExpandedScopes(scopes: Array<DebugVariableWithRawScope>) {
    for (const scope of scopes) {
      if (this.isPreservedRootScope(scope) && this.keepExpandedScopesModel.isScopeExpanded(scope) && !scope.expanded) {
        await scope.setExpanded(true);
      }

      const cacheExpands = this.keepExpandedScopesModel.getExpandedVariables(scope);
      const children = (scope.children || []) as Array<DebugVariableWithRawScope>;
      for (const child of children) {
        if (cacheExpands.includes(child.variablesReference)) {
          await child.setExpanded(true);
          if (Array.isArray(child.children)) {
            await this.restoreExpandedScopes(child.children as Array<DebugVariableWithRawScope>);
          }
        }
      }
    }
  }

  /**
   * 刷新指定节点下的所有子节点
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
    return this.queueChangeEvent(node.path, async () => {
      const scopes = (this.treeModel?.root.children as Array<DebugVariableWithRawScope>) || [];
      await this.restoreExpandedScopes(scopes);
      this.onDidRefreshedEmitter.fire();
    });
  }

  private queueChangeEvent(path: string, callback: () => Promise<void> | void) {
    if (this._changeEventDispatchQueue.indexOf(path) === -1) {
      this._changeEventDispatchQueue.push(path);
    }
    this._pendingFlushCallbacks.push(callback);

    if (!this.flushEventQueueDeferred) {
      this.flushEventQueueDeferred = new Deferred<void>();
      clearTimeout(this._eventFlushTimeout);
      this._eventFlushTimeout = setTimeout(async () => {
        try {
          this._isFlushingEventQueue = true;
          while (this._changeEventDispatchQueue.length > 0 || this._pendingFlushCallbacks.length > 0) {
            const pendingFlushCallbacks = [...this._pendingFlushCallbacks];
            this._pendingFlushCallbacks = [];

            await this.flushQueuedEventBatch();
            await pSeries(
              pendingFlushCallbacks.map((pendingFlushCallback) => async () => {
                await pendingFlushCallback();
                return null;
              }),
            );
          }

          this.flushEventQueueDeferred?.resolve();
        } catch (error) {
          this.flushEventQueueDeferred?.reject(error);
        } finally {
          this._isFlushingEventQueue = false;
          this.flushEventQueueDeferred = null;
        }
      }, DebugVariablesModelService.DEFAULT_REFRESH_DELAY) as any;
    }

    return this.flushEventQueueDeferred.promise;
  }

  private isSameOrParentPath(basePath: string, targetPath: string) {
    const base = new Path(basePath);
    const target = new Path(targetPath);
    return base.isEqual(target) || base.isEqualOrParent(target);
  }

  public flushEventQueue = () => {
    if (this._isFlushingEventQueue) {
      return;
    }
    return this.flushQueuedEventBatch();
  };

  private flushQueuedEventBatch = () => {
    if (!this._changeEventDispatchQueue || this._changeEventDispatchQueue.length === 0) {
      return;
    }

    const queuedPaths = [...this._changeEventDispatchQueue];
    this._changeEventDispatchQueue = [];

    queuedPaths.sort((pathA, pathB) => {
      const pathADepth = Path.pathDepth(pathA);
      const pathBDepth = Path.pathDepth(pathB);
      return pathADepth - pathBDepth;
    });
    const roots = [queuedPaths[0]];
    for (const path of queuedPaths) {
      if (roots.some((root) => this.isSameOrParentPath(root, path))) {
        continue;
      } else {
        roots.push(path);
      }
    }
    return pSeries(
      roots.map((path) => async () => {
        const watcher = this.treeModel?.root?.watchEvents.get(path);
        if (watcher && typeof watcher.callback === 'function') {
          await watcher.callback({ type: WatchEvent.Changed, path });
        }
        return null;
      }),
    );
  };

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: ExpressionContainer | ExpressionNode, dispatchChange = true) => {
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

      if (dispatchChange) {
        // 通知视图更新
        this.treeModel?.dispatchChange();
      }
    }
  };

  // 右键菜单焦点态切换
  activeNodeActivedDecoration = (target: ExpressionContainer | ExpressionNode) => {
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
    this.decorations.removeDecoration(this.loadingDecoration);
    this.decorations.removeDecoration(this.contextMenuDecoration);
  }

  handleContextMenu = (
    ev: React.MouseEvent,
    expression?: DebugScope | DebugVariableContainer | DebugVariable | undefined,
  ) => {
    ev.stopPropagation();
    ev.preventDefault();

    if (!expression || expression instanceof DebugScope) {
      this.enactiveNodeDecoration();
      this.debugContextKey.contextVariableEvaluateNamePresent.set(false);
      return;
    }

    this._currentVariableInternalContext = expression;
    const { x, y } = ev.nativeEvent;

    if (expression) {
      this.activeNodeActivedDecoration(expression);
      this.debugContextKey.contextDebugProtocolVariableMenu.set(expression.variableMenuContext);
      this.debugContextKey.contextVariableEvaluateNamePresent.set(
        !!(expression as DebugVariableContainer | DebugVariable).evaluateName,
      );
    }

    // 决定某一变量是否允许以十六进制视图查看
    if (expression.session?.capabilities.supportsReadMemoryRequest && expression.memoryReference !== undefined) {
      this.debugContextKey.contextCanViewMemory.set(true);
    } else {
      this.debugContextKey.contextCanViewMemory.set(false);
    }

    const menus = this.contextMenuService.createMenu({
      id: MenuId.DebugVariablesContext,
      contextKeyService: this.debugContextKey.contextKeyScoped,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [expression.toDebugProtocolObject()],
    });
  };

  handleTreeHandler(handle: IDebugVariablesHandle) {
    this._debugVariablesTreeHandle = {
      ...handle,
      getModel: () => this.treeModel!,
    };
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveNodeDecoration();
  };

  handleItemClick = (item: ExpressionContainer | ExpressionNode) => {
    // 单选操作默认先更新选中状态
    this.activeNodeDecoration(item);
  };

  handleTwistierClick = (item: ExpressionContainer | ExpressionNode, type: TreeNodeType) => {
    if (type === TreeNodeType.CompositeTreeNode) {
      this.activeNodeDecoration(item, false);
      this.toggleDirectory(item as DebugVariableWithRawScope);
    } else {
      this.activeNodeDecoration(item);
    }
  };

  toggleDirectory = async (item: DebugVariableWithRawScope) => {
    if (item.expanded) {
      item.setCollapsed();
    } else {
      await item.setExpanded(true);
    }
    this.keepExpandedScopesModel.set(item);
  };

  async copyEvaluateName(node: DebugVariableContainer | DebugVariable | undefined) {
    if (!node) {
      return;
    }

    await this.clipboardService.writeText(node.evaluateName);
  }

  async copyValue(node: DebugVariableContainer | DebugVariable | undefined) {
    if (!node) {
      return;
    }

    const getClipboardValue = async () => {
      if (node.session && node.session.capabilities.supportsValueFormattingOptions) {
        try {
          const {
            variable: { evaluateName },
          } = node;
          if (evaluateName) {
            const body = await node.session.evaluate(evaluateName, 'clipboard');
            if (body) {
              return body.result;
            }
          }
          return '';
        } catch (err) {
          return '';
        }
      } else {
        return node.value;
      }
    };
    const value = await getClipboardValue();
    if (value) {
      await this.clipboardService.writeText(value);
    }
  }
}
