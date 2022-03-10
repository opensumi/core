import pSeries from 'p-series';

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
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { Path } from '@opensumi/ide-core-common/lib/path';

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

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private contextMenuDecoration: Decoration = new Decoration(styles.mod_actived); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  // 即使选中态也是焦点态的节点
  private _focusedNode: AnsiConsoleNode | DebugConsoleNode | undefined;
  // 选中态的节点
  private _selectedNodes: (AnsiConsoleNode | DebugConsoleNode)[] = [];
  // 右键菜单选中态的节点
  private _contextMenuNode: AnsiConsoleNode | DebugConsoleNode | undefined;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelEmitter: Emitter<IDebugConsoleModel | void> = new Emitter();

  // 右键菜单局部ContextKeyService
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

  get onDidUpdateTreeModel(): Event<IDebugConsoleModel | void> {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  clear = () => {
    // 重新初始化Console中渲染的TreeModel
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
        // 更新树前更新下选中节点
        if (this.selectedNodes.length !== 0) {
          // 仅处理一下单选情况
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
    // 根据 IDebugSessionReplMode 判断子 session 是否要共享父 session 的 repl
    const sessionId = session.hasSeparateRepl() ? session.id : session.parentSession!.id;

    if (this.debugSessionModelMap.has(sessionId) && !force) {
      const model = this.debugSessionModelMap.get(sessionId);
      this._activeDebugSessionModel = model;
    } else {
      // 根据是否为多工作区创建不同根节点
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

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: AnsiConsoleNode | DebugConsoleNode, dispatchChange = true) => {
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
      }
      this.selectedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      if (dispatchChange) {
        // 通知视图更新
        this.treeModel?.dispatchChange();
      }
    }
  };

  // 右键菜单焦点态切换
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

  // 取消选中节点焦点
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
      // 空白区域右键菜单
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
    // 清空焦点状态
    this.enactiveNodeDecoration();
  };

  handleItemClick = (item: AnsiConsoleNode | DebugConsoleNode) => {
    // 单选操作默认先更新选中状态
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
    // 重置更新队列
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
