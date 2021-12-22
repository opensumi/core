import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeEvent } from '@opensumi/ide-components';
import { Emitter, Event, DisposableCollection } from '@opensumi/ide-core-browser';
import { DebugHoverModel } from './debug-hover-model';
import { DebugVariable, ExpressionContainer, ExpressionNode } from '../tree/debug-tree-node.define';
import { ExpressionVariable, DebugHoverSource } from './debug-hover-source';
import styles from '../view/variables/debug-variables.module.less';

export interface IDebugVariablesHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

export interface IDebugHoverUpdateData {
  treeModel?: DebugHoverModel;
  variable?: DebugVariable;
}

@Injectable()
export class DebugHoverTreeModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(DebugHoverSource)
  private readonly debugHoverSource: DebugHoverSource;

  private _treeModel: DebugHoverModel;
  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _debugHoverTreeHandle: IDebugVariablesHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态

  // 即使选中态也是焦点态的节点
  private _focusedNode: ExpressionContainer | ExpressionNode | undefined;
  // 选中态的节点
  private _selectedNodes: (ExpressionContainer | ExpressionNode)[] = [];

  private preContextMenuFocusedNode: ExpressionContainer | ExpressionNode | null;

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private onDidUpdateTreeModelOrVariableEmitter: Emitter<IDebugHoverUpdateData | void> = new Emitter();

  private disposableCollection: DisposableCollection = new DisposableCollection();

  constructor() {
    this.debugHoverSource.onDidChange(async (expression: ExpressionVariable | DebugVariable | undefined) => {
      if (!expression) {
        this.onDidUpdateTreeModelOrVariableEmitter.fire({ treeModel: undefined, variable: undefined });
        return;
      }

      if (expression instanceof DebugVariable) {
        this.dispose();
        this.onDidUpdateTreeModelOrVariableEmitter.fire({ variable: expression });
      } else {
        await this.initTreeModel(expression);
        this.onDidUpdateTreeModelOrVariableEmitter.fire({ treeModel: this.treeModel });
      }
    });
  }

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }

  get onDidUpdateTreeModelOrVariable(): Event<IDebugHoverUpdateData | void> {
    return this.onDidUpdateTreeModelOrVariableEmitter.event;
  }

  get treeHandle() {
    return this._debugHoverTreeHandle;
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

  dispose() {
    if (!this.disposableCollection.disposed) {
      this.disposableCollection.dispose();
    }
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
      this.treeModel.onWillUpdate(() => {
        // 更新树前更新下选中节点
        if (this.selectedNodes.length !== 0) {
          // 仅处理一下单选情况
          const node = this.treeModel?.root.getTreeNodeByPath(this.selectedNodes[0].path);
          this.selectedDecoration.addTarget(node as ExpressionNode);
        }
      }),
    );
  }

  async initTreeModel(root: ExpressionVariable) {
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(DebugHoverModel, [root]);

    this.initDecorations(root);
    this.listenTreeViewChange();
    return this._treeModel;
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: ExpressionContainer | ExpressionNode, dispatchChange = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.preContextMenuFocusedNode = null;
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
        this.treeModel.dispatchChange();
      }
    }
  };

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeNodeFocusedDecoration = (target: ExpressionContainer | ExpressionNode, removePreFocusedDecoration = false) => {
    if (this.focusedNode !== target) {
      if (removePreFocusedDecoration) {
        // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
        if (this.preContextMenuFocusedNode) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
        } else if (this.focusedNode) {
          // 多选情况下第一次切换焦点文件
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
    // 通知视图更新
    this.treeModel.dispatchChange();
  };

  // 取消选中节点焦点
  enactiveNodeDecoration = () => {
    if (this.focusedNode) {
      this.focusedDecoration.removeTarget(this.focusedNode);
      this.treeModel.dispatchChange();
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

  handleTreeHandler(handle: IDebugVariablesHandle) {
    this._debugHoverTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveNodeDecoration();
  };

  handleTwistierClick = (item: ExpressionContainer | ExpressionNode) => {
    // 单选操作默认先更新选中状态
    if (!ExpressionContainer.is(item)) {
      this.activeNodeDecoration(item);
    } else {
      this.activeNodeDecoration(item, false);
      this.toggleDirectory(item as ExpressionContainer);
    }
  };

  toggleDirectory = async (item: ExpressionContainer) => {
    if (item.expanded) {
      this.treeHandle.collapseNode(item);
    } else {
      this.treeHandle.expandNode(item);
    }
  };

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: ExpressionContainer = this.treeModel.root as ExpressionContainer) {
    if (!ExpressionContainer.is(node) && (node as ExpressionContainer).parent) {
      node = (node as ExpressionContainer).parent as ExpressionContainer;
    }
    await node.refresh();
  }
}
