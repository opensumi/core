import { isEqual } from 'lodash';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  TreeModel,
  DecorationsManager,
  Decoration,
  IRecycleTreeHandle,
  TreeNodeType,
  TreeNodeEvent,
} from '@opensumi/ide-components';
import {
  Emitter,
  ThrottledDelayer,
  Deferred,
  Event,
  DisposableCollection,
  IClipboardService,
} from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';


import { DebugSession } from '../../debug-session';
import {
  ExpressionContainer,
  ExpressionNode,
  DebugVariableRoot,
  DebugVariableContainer,
  DebugVariable,
  DebugScope,
} from '../../tree/debug-tree-node.define';
import { DebugViewModel } from '../debug-view-model';

import { DebugContextKey } from './../../contextkeys/debug-contextkey.service';
import { DebugVariablesModel } from './debug-variables-model';
import styles from './debug-variables.module.less';

export interface IDebugVariablesHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export type DebugVariableWithRawScope = DebugScope | DebugVariableContainer;

class KeepExpandedScopesModel {
  private _keepExpandedScopesMap = new Map<DebugProtocol.Scope, Array<number>>();
  constructor() {}

  private getMirrorScope(item: DebugVariableWithRawScope) {
    return Array.from(this._keepExpandedScopesMap.keys()).find((f) => isEqual(f, item.getRawScope()));
  }

  set(item: DebugVariableWithRawScope): void {
    const scope = item.getRawScope();
    if (scope) {
      const keepScope = this.getMirrorScope(item);
      if (keepScope) {
        const kScopeVars = this._keepExpandedScopesMap.get(keepScope)!;
        let nScopeVars: number[];
        if (item.expanded) {
          nScopeVars = Array.from(new Set([...kScopeVars, item.variablesReference]));
        } else {
          nScopeVars = kScopeVars.filter((v) => v !== item.variablesReference);
        }
        this._keepExpandedScopesMap.set(keepScope, nScopeVars);
      } else {
        this._keepExpandedScopesMap.set(scope, item.expanded ? [item.variablesReference] : []);
      }
    }
  }

  get(item: DebugVariableWithRawScope): number[] {
    const keepScope = this.getMirrorScope(item);
    if (keepScope) {
      return this._keepExpandedScopesMap.get(keepScope) || [];
    } else {
      return [];
    }
  }

  clear(): void {
    this._keepExpandedScopesMap.clear();
  }
}

@Injectable()
export class DebugVariablesModelService {
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

  private keepExpandedScopesModel: KeepExpandedScopesModel = new KeepExpandedScopesModel();

  constructor() {
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
    if (!this.disposableCollection.disposed) {
      this.disposableCollection.dispose();
    }
  }

  listenViewModelChange() {
    this.viewModel.onDidChange(async () => {
      this.flushDispatchChangeDelayer.cancel();
      this.flushDispatchChangeDelayer.trigger(async () => {
        if (this.viewModel && this.viewModel.currentSession && !this.viewModel.currentSession.terminated) {
          const currentTreeModel = await this.initTreeModel(this.viewModel.currentSession);
          this._activeTreeModel = currentTreeModel;
          await this._activeTreeModel?.root.ensureLoaded();
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

          const execExpands = async (data: Array<DebugVariableWithRawScope>) => {
            for (const s of data) {
              const cacheExpands = this.keepExpandedScopesModel.get(s);
              if (cacheExpands.includes(s.variablesReference)) {
                await s.setExpanded(true);
                if (Array.isArray(s.children)) {
                  await execExpands(s.children as Array<DebugVariableWithRawScope>);
                }
              }
            }
          };

          scopes.forEach(async (s) => {
            if (Array.isArray(s.children)) {
              await execExpands(s.children as Array<DebugVariableWithRawScope>);
            }
          });
        } else {
          this._activeTreeModel = undefined;
          this.keepExpandedScopesModel.clear();
        }

        this.onDidUpdateTreeModelEmitter.fire(this._activeTreeModel);
      });
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
