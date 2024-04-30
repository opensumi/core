import { DisposableCollection, Emitter } from '@opensumi/ide-utils';

import { Decoration, DecorationsManager, Tree, TreeModel } from '../tree';
import { TreeNodeEvent } from '../types';

import { BasicCompositeTreeNode, BasicTreeNode, BasicTreeRoot } from './tree-node.define';
import { DECORATIONS, IBasicTreeData } from './types';

export interface IBasicTreeServiceOptions {
  treeName?: string;
}

export class BasicTreeService extends Tree {
  private selectedDecoration: Decoration = new Decoration(DECORATIONS.SELECTED); // 选中态
  private focusedDecoration: Decoration = new Decoration(DECORATIONS.FOCUSED); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration(DECORATIONS.ACTIVED); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration(DECORATIONS.LOADING); // 加载态
  // 即使选中态也是焦点态的节点
  private _focusedNode: BasicCompositeTreeNode | BasicTreeNode | undefined;
  // 选中态的节点
  private _selectedNodes: (BasicCompositeTreeNode | BasicTreeNode)[] = [];
  // 右键菜单选择的节点
  private _contextMenuNode: BasicCompositeTreeNode | BasicTreeNode | undefined;

  private _model: BasicTreeModel;
  private _decorations: DecorationsManager;

  private disposableCollection: DisposableCollection = new DisposableCollection();
  private decorationDisposableCollection: DisposableCollection = new DisposableCollection();

  private onDidUpdateTreeModelEmitter: Emitter<BasicTreeModel> = new Emitter();

  constructor(
    private _treeData?: IBasicTreeData[],
    private _resolveChildren?: (parent?: IBasicTreeData) => IBasicTreeData[] | null,
    private _sortComparator?: (a: IBasicTreeData, b: IBasicTreeData) => number | undefined,
    private treeOptions = {} as IBasicTreeServiceOptions,
  ) {
    super();
    this.disposableCollection.push(this.onDidUpdateTreeModelEmitter);
  }

  private setUpTreeModel() {
    this._root = new BasicTreeRoot(
      this,
      undefined,
      { children: this._treeData, label: '', command: '', icon: '' },
      {
        treeName: this.treeOptions.treeName,
      },
    );
    this._model = new BasicTreeModel();
    this._model.init(this._root);
    this.initDecorations(this._root as BasicTreeRoot);
    this.onDidUpdateTreeModelEmitter.fire(this._model);
  }

  private resetState() {
    this._selectedNodes = [];
    this._contextMenuNode = undefined;
    this._focusedNode = undefined;
  }

  get onDidUpdateTreeModel() {
    return this.onDidUpdateTreeModelEmitter.event;
  }

  get model() {
    return this._model;
  }

  get root() {
    return this._root;
  }

  get decorations() {
    return this._decorations;
  }

  private initDecorations(root: BasicTreeRoot) {
    this.decorationDisposableCollection.dispose();

    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
    this.decorationDisposableCollection.push(
      root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
        this.loadingDecoration.addTarget(target);
      }),
    );
    this.decorationDisposableCollection.push(
      root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
        this.loadingDecoration.removeTarget(target);
      }),
    );
    this.decorationDisposableCollection.push(this._decorations);
  }

  updateTreeData(treeData: IBasicTreeData[]) {
    this._treeData = treeData;
    this.resetState();
    this.setUpTreeModel();
  }

  async resolveChildren(parent?: BasicCompositeTreeNode) {
    if (this._resolveChildren) {
      return this.transformTreeNode(parent, this._resolveChildren(parent?.raw) || []);
    } else {
      return this.transformTreeNode(parent, parent?.raw.children || []);
    }
  }

  sortComparator = (a: BasicCompositeTreeNode, b: BasicCompositeTreeNode) => {
    if (this._sortComparator) {
      const result = this._sortComparator(a.raw, b.raw);
      if (typeof result !== 'undefined') {
        return result;
      }
    }
    return super.sortComparator(a, b);
  };

  private transformTreeNode(parent?: BasicCompositeTreeNode, nodes?: IBasicTreeData[]) {
    if (!nodes) {
      return [];
    }
    const result: (BasicCompositeTreeNode | BasicTreeNode)[] = [];
    for (const node of nodes) {
      if (node.children) {
        result.push(new BasicCompositeTreeNode(this, parent, node));
      } else {
        result.push(new BasicTreeNode(this, parent, node));
      }
    }
    return result;
  }

  get selectedNodes() {
    return this._selectedNodes;
  }

  get focusedNode() {
    return this._focusedNode;
  }

  get contextMenuNode() {
    return this._contextMenuNode;
  }

  private clearDecoration(decoration: Decoration) {
    for (const target of decoration.appliedTargets.keys()) {
      decoration.removeTarget(target);
    }
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFocusedDecoration = (target: BasicCompositeTreeNode | BasicTreeNode) => {
    if (this._contextMenuNode) {
      this.clearDecoration(this.contextMenuDecoration);
      this.clearDecoration(this.focusedDecoration);
      this.clearDecoration(this.selectedDecoration);
      this._contextMenuNode = undefined;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.clearDecoration(this.selectedDecoration);
      }
      if (this.focusedNode) {
        this.clearDecoration(this.focusedDecoration);
        this._focusedNode = undefined;
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedNode = target;
      this._selectedNodes = [target];

      this.model?.dispatchChange();
    }
  };

  activeContextMenuDecoration = (target: BasicCompositeTreeNode | BasicTreeNode) => {
    if (this._contextMenuNode) {
      this.clearDecoration(this.contextMenuDecoration);
      this._contextMenuNode = undefined;
    }
    if (this.focusedNode) {
      this.clearDecoration(this.focusedDecoration);
      this._focusedNode = undefined;
    }
    this.contextMenuDecoration.addTarget(target);
    this._contextMenuNode = target;
    this.model?.dispatchChange();
  };

  // 取消选中节点焦点
  enactiveFocusedDecoration = () => {
    if (this.focusedNode) {
      this.clearDecoration(this.focusedDecoration);
      this._focusedNode = undefined;
      this.model?.dispatchChange();
    }
  };

  dispose() {
    super.dispose();
    this.disposableCollection.dispose();
    this.decorationDisposableCollection.dispose();
  }
}

export class BasicTreeModel extends TreeModel {}
