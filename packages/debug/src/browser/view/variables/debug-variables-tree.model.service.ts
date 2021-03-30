import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel, DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, WatchEvent, TreeNodeEvent } from '@ali/ide-components';
import { Emitter, IContextKeyService, ThrottledDelayer, Deferred, Event, DisposableCollection, IClipboardService } from '@ali/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { DebugVariablesModel } from './debug-variables-model';
import { Path } from '@ali/ide-core-common/lib/path';
import pSeries = require('p-series');
import { ExpressionContainer, ExpressionNode, DebugVariableRoot, DebugVariableContainer, DebugVariable } from '../../tree/debug-tree-node.define';
import { DebugViewModel } from '../debug-view-model';
import { DebugSession } from '../../debug-session';

import * as styles from './debug-variables.module.less';
import { DebugStackFrame } from '../../model';

export interface IDebugVariablesHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class DebugVariablesModelService {
  private static DEFAULT_FLUSH_EVENT_DELAY = 100;
  private static DEFAULT_TRIGGER_DELAY = 200;

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

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  private _activeTreeModel: DebugVariablesModel | undefined;
  private allTreeModel: Map<DebugStackFrame, DebugVariablesModel> = new Map();

  private _decorations: DecorationsManager;
  private _debugVariablesTreeHandle: IDebugVariablesHandle;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  // 即使选中态也是焦点态的节点
  private _focusedNode: ExpressionContainer | ExpressionNode | undefined;
  // 选中态的节点
  private _selectedNodes: (ExpressionContainer | ExpressionNode)[] = [];

  private preContextMenuFocusedFile: ExpressionContainer | ExpressionNode | null;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelEmitter: Emitter<TreeModel | void> = new Emitter();

  // 右键菜单局部ContextKeyService
  private _contextMenuContextKeyService: IContextKeyService;

  private flushDispatchChangeDelayer =  new ThrottledDelayer<void>(DebugVariablesModelService.DEFAULT_TRIGGER_DELAY);

  private disposableCollection: DisposableCollection = new DisposableCollection();

  constructor() {
    this.listenViewModelChange();
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
    return this._debugVariablesTreeHandle;
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

  listenViewModelChange() {
    this.viewModel.onDidChange(async () => {
      this.flushDispatchChangeDelayer.cancel();
      this.flushDispatchChangeDelayer.trigger(async () => {
        if (this.viewModel && this.viewModel.currentSession && !this.viewModel.currentSession.terminated) {
          if (this.viewModel.currentSession?.currentFrame && this.allTreeModel.has(this.viewModel.currentSession?.currentFrame)) {
            const currentTreeModel = this.allTreeModel.get(this.viewModel.currentSession?.currentFrame);
            if (this._activeTreeModel !== currentTreeModel) {
              // 当前TreeModel与激活态TreeModel不一致时，更新变量树model
              this._activeTreeModel = currentTreeModel;
            }
          } else {
            const currentTreeModel = await this.initTreeModel(this.viewModel.currentSession);
            if (this.viewModel.currentSession?.currentFrame && currentTreeModel) {
              this.allTreeModel.set(this.viewModel.currentSession?.currentFrame, currentTreeModel);
            }
          }
        } else {
          // 进程退出时，默认移除对应堆栈下的TreeModel
          if (this.viewModel.currentSession?.currentFrame) {
            this.allTreeModel.delete(this.viewModel.currentSession?.currentFrame);
          }
          this._activeTreeModel = undefined;
        }

        this.onDidUpdateTreeModelEmitter.fire(this._activeTreeModel);
      });
    });
  }

  listenTreeViewChange() {
    this.dispose();
    this.disposableCollection.push(this.treeModel?.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
      this.loadingDecoration.addTarget(target);
    }));
    this.disposableCollection.push(this.treeModel?.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
      this.loadingDecoration.removeTarget(target);
    }));
    this.disposableCollection.push(this.treeModel!.onWillUpdate(() => {
      // 更新树前更新下选中节点
      if (this.selectedNodes.length !== 0) {
        // 仅处理一下单选情况
        const node = this.treeModel?.root.getTreeNodeByPath(this.selectedNodes[0].path);
        this.selectedDecoration.addTarget(node as ExpressionNode);
      }
    }));
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

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedNodes.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedNodes = [];
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: ExpressionContainer | ExpressionNode, dispatchChange: boolean = true) => {
    if (this.preContextMenuFocusedFile) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.preContextMenuFocusedFile = null;
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
  }

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeNodeFocusedDecoration = (target: ExpressionContainer | ExpressionNode, removePreFocusedDecoration: boolean = false) => {
    if (this.focusedNode !== target) {
      if (removePreFocusedDecoration) {
        // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
        if (this.preContextMenuFocusedFile) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
        } else if (!!this.focusedNode) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedNode);
        }
        this.preContextMenuFocusedFile = target;
      } else if (!!this.focusedNode) {
        this.preContextMenuFocusedFile = null;
        this.focusedDecoration.removeTarget(this.focusedNode);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedNode = target;
        this._selectedNodes.push(target);
      }
    }
    // 通知视图更新
    this.treeModel?.dispatchChange();
  }

  // 取消选中节点焦点
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel?.dispatchChange();
    }
    this._focusedNode = undefined;
  }

  removeNodeDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, expression?: ExpressionContainer | ExpressionNode) => {
    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;

    if (expression) {
      this.activeNodeFocusedDecoration(expression, true);
    } else {
      this.enactiveNodeDecoration();
    }
    let node: ExpressionContainer | ExpressionNode;

    if (!expression) {
      // 空白区域右键菜单
      node = this.treeModel?.root as ExpressionContainer;
    } else {
      node = expression;
    }
    const menus = this.contextMenuService.createMenu({id: MenuId.DebugVariablesContext, contextKeyService: this.contextMenuContextKeyService});
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [node],
    });
  }

  handleTreeHandler(handle: IDebugVariablesHandle) {
    this._debugVariablesTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveNodeDecoration();
  }

  handleItemClick = (item: ExpressionContainer | ExpressionNode) => {
    // 单选操作默认先更新选中状态
    this.activeNodeDecoration(item);
  }

  handleTwistierClick = (item: ExpressionContainer | ExpressionNode, type: TreeNodeType) => {
    if (type === TreeNodeType.CompositeTreeNode) {
      this.activeNodeDecoration(item, false);
      this.toggleDirectory(item as ExpressionContainer);
    } else {
      this.activeNodeDecoration(item);
    }
  }

  toggleDirectory = async (item: ExpressionContainer) => {
    if (item.expanded) {
      this.treeHandle.collapseNode(item);
    } else {
      this.treeHandle.expandNode(item);
    }
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node?: ExpressionContainer) {
    if (!node) {
      if (!!this.treeModel) {
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
      }, DebugVariablesModelService.DEFAULT_FLUSH_EVENT_DELAY) as any;
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
    promise = pSeries(roots.map((path) => async () => {
      const watcher = this.treeModel?.root?.watchEvents.get(path);
      if (watcher && typeof watcher.callback === 'function') {
        await watcher.callback({ type: WatchEvent.Changed, path });
      }
      return null;
    }));
    // 重置更新队列
    this._changeEventDispatchQueue = [];
    return promise;
  }

  async copyValue(node: DebugVariableContainer | DebugVariable) {
    const getClipboardValue = async () => {
      if (node.session && node.session.capabilities.supportsValueFormattingOptions) {
        try {
          const { variable: { evaluateName } } = node;
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
