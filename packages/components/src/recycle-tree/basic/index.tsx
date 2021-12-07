import React, { useCallback, useRef, useEffect, useState } from 'react';
import { TreeModel, Tree, Decoration, DecorationsManager, CompositeTreeNode, TreeNode } from '../tree';
import { RecycleTree, IRecycleTreeHandle } from '../RecycleTree';
import { ITreeNodeOrCompositeTreeNode, ICompositeTreeNode } from '../types';
import { INodeRendererWrapProps } from '../TreeNodeRendererWrap';
import { IBasicInlineMenuPosition, IBasicNodeRendererProps, IBasicRecycleTreeProps, IBasicTreeData } from './types';
import { Emitter } from '../../utils';
import { Icon } from '../../icon';
import { Button } from '../../button';
import cls from 'classnames';
import './styles.less';

export const BasicTreeNodeRenderer: React.FC<IBasicNodeRendererProps & { item: BasicCompositeTreeNode | BasicTreeNode }> = ({
  item,
  className,
  itemHeight,
  indent = 8,
  onClick,
  onTwistierClick,
  decorations,
  inlineMenus = [],
  inlineMenuActuator = () => {},
}: IBasicNodeRendererProps & { item: BasicCompositeTreeNode | BasicTreeNode }) => {
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (onClick) {
      event.stopPropagation();
      onClick(item as any);
    }
  }, [onClick]);

  const handlerTwistierClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();

    if (onTwistierClick) {
      onTwistierClick(item as any);
    } else if (onClick) {
      onClick(item as any);
    }
  }, [onClick, onTwistierClick]);

  const paddingLeft = `${8 + (item.depth || 0) * (indent || 0) + (!BasicCompositeTreeNode.is(item) ? 20 : 0)}px`;

  const editorNodeStyle = {
    height: itemHeight,
    lineHeight: `${itemHeight}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderIcon = useCallback((node: BasicCompositeTreeNode | BasicTreeNode) => {
    return <Icon icon={node.icon} className='icon' style={{ height: itemHeight, lineHeight: `${itemHeight}px`}}/>;
  }, []);

  const getName = useCallback((node: BasicCompositeTreeNode | BasicTreeNode) => {
    return node.displayName.replace(/\n/g, '↵');
  }, []);

  const renderDisplayName = useCallback((node: BasicCompositeTreeNode | BasicTreeNode) => {
    return <div
      className={cls('segment', 'display_name')}
    >
      {getName(node)}
    </div>;
  }, []);

  const renderDescription = useCallback((node: BasicCompositeTreeNode | BasicTreeNode) => {
    if (!node.description) {
      return null;
    }
    return <div className={cls('segment_grow', 'description')}>
      {node.description}
    </div>;
  }, []);

  const inlineMenuActions = useCallback(() => {
    if (Array.isArray(inlineMenus)) {
      return inlineMenus;
    } else if (typeof inlineMenus === 'function') {
      return inlineMenus();
    }
  }, [inlineMenus]);

  const renderNodeTail = () => {
    const isBasicCompositeTreeNode = BasicCompositeTreeNode.is(item);
    const actions = inlineMenuActions()?.filter((menu) => isBasicCompositeTreeNode ? menu.position === IBasicInlineMenuPosition.TREE_CONTAINER : menu.position === IBasicInlineMenuPosition.TREE_NODE);
    if (!actions?.length) {
      return null;
    }
    const handleActionClick = useCallback((event: React.MouseEvent, action) => {
      event.stopPropagation();
      inlineMenuActuator(item, action);
    }, []);
    return <div className={cls('segment', 'tail')}>
      {
        actions.map((action) => {
          return <Button
            style={{marginRight: '5px'}}
            type='icon'
            key={`${item.id}-${action.icon}`}
            icon={action.icon}
            title={action.title}
            onClick={(e) => handleActionClick(e, action)}
          />;
        })
      }
    </div>;
  };

  const renderFolderToggle = (node: BasicCompositeTreeNode, clickHandler: any) => {
    return <Icon
    className={cls(
      'segment',
      'expansion_toggle',
      { ['mod_collapsed']: !(node as BasicCompositeTreeNode).expanded },
    )}
    onClick={clickHandler}
    icon='arrow-right'
    />;
  };

  const renderTwice = (item) => {
    if (BasicCompositeTreeNode.is(item)) {
      return renderFolderToggle(item as BasicCompositeTreeNode, handlerTwistierClick);
    }
  };

  return (
    <div
      key={item.id}
      onClick={handleClick}
      className={cls(
        className,
        'tree_node',
        decorations ? decorations.classlist : null,
      )}
      style={editorNodeStyle}
      data-id={item.id}
    >
      <div className='content'>
        {renderTwice(item)}
        {renderIcon(item)}
        <div
          className={'overflow_wrap'}
        >
          {renderDisplayName(item)}
          {renderDescription(item)}
        </div>
        {renderNodeTail()}
      </div>
    </div>
  );
};

export const BasicRecycleTree: React.FC<IBasicRecycleTreeProps> = ({
  width,
  height,
  outline,
  foldable,
  itemHeight = 22,
  itemClassname,
  containerClassname,
  onClick,
  onContextMenu,
  onTwistierClick,
  onDbClick,
  resolveChildren,
  sortComparator,
  treeData,
  inlineMenus,
  inlineMenuActuator,
  contextMenus,
  contextMenuActuator,
}) => {
  const [model, setModel] = useState<BasicTreeModel | undefined>();
  const treeService = useRef<BasicTreeService>(new BasicTreeService(treeData, resolveChildren, sortComparator));
  const treeHandle = useRef<IRecycleTreeHandle>();
  const renderTreeNode = useCallback((props: INodeRendererWrapProps) => {
    return <BasicTreeNodeRenderer
      item={props.item as any}
      itemType={props.itemType}
      className={itemClassname}
      inlineMenus={inlineMenus}
      inlineMenuActuator={inlineMenuActuator}
      onClick={handleItemClick}
      onDbClick={handleItemDbClick}
      onContextMenu={handleContextMenu}
      onTwistierClick={handleTwistierClick}
      decorations={treeService.current.decorations.getDecorations(props.item as ITreeNodeOrCompositeTreeNode)}
    />;
  }, []);

  useEffect(() => {
    ensureLoaded();
    const disposable = treeService.current.onDidUpdateTreeModel(async (model?: BasicTreeModel) => {
      await model?.root.ensureLoaded();
      setModel(model);
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  const ensureLoaded = async () => {
    const model = treeService.current.model;
    if (model) {
      await model.root.ensureLoaded();
    }
    setModel(model);
  };

  const handleTreeReady = useCallback((handle: IRecycleTreeHandle) => {
    treeHandle.current = handle;
  }, []);

  const handleItemClick = useCallback((item: BasicCompositeTreeNode | BasicTreeNode) => {
    treeService.current.activeNodeDecoration(item);
    if (onClick) {
      onClick(item);
    }
    if (BasicCompositeTreeNode.is(item)) {
      toggleDirectory(item);
    }
  }, [onClick]);

  const handleItemDbClick = useCallback((item: BasicCompositeTreeNode | BasicTreeNode) => {
    if (onDbClick) {
      onDbClick(item);
    }
  }, [onDbClick]);

  const handleContextMenu = useCallback((item: BasicCompositeTreeNode | BasicTreeNode) => {
    treeService.current.activeNodeDecoration(item);
    if (onDbClick) {
      onDbClick(item);
    }
  }, [onDbClick]);

  const toggleDirectory = useCallback((item: BasicCompositeTreeNode) => {
    if (item.expanded) {
      treeHandle.current?.collapseNode(item);
    } else {
      treeHandle.current?.expandNode(item);
    }
  }, []);

  const handleTwistierClick = useCallback((item: BasicCompositeTreeNode | BasicTreeNode) => {
    if (BasicCompositeTreeNode.is(item)) {
      toggleDirectory(item);
    }
    if (onTwistierClick) {
      onTwistierClick(item);
    }
  }, [onTwistierClick]);

  return model
  ? <RecycleTree
    height={height}
    itemHeight={itemHeight}
    model={model}
    onReady={handleTreeReady}
    className={cls(containerClassname, 'basic_tree')}
  >
    {renderTreeNode}
  </RecycleTree>
  : null;
};

export class BasicTreeService extends Tree {
  private selectedDecoration: Decoration = new Decoration('mod_selected'); // 选中态
  private focusedDecoration: Decoration = new Decoration('mod_focused'); // 焦点态
  private contextMenuDecoration: Decoration = new Decoration('mod_actived'); // 右键菜单激活态
  private loadingDecoration: Decoration = new Decoration('mod_loading'); // 加载态
  // 即使选中态也是焦点态的节点
  private _focusedNode: BasicCompositeTreeNode | BasicTreeNode | undefined;
  // 选中态的节点
  private _selectedNodes: (BasicCompositeTreeNode | BasicTreeNode)[] = [];

  private preContextMenuFocusedNode: BasicCompositeTreeNode | BasicTreeNode | null;

  private _model: BasicTreeModel;
  private _decorations: DecorationsManager;

  private onDidUpdateTreeModelEmitter: Emitter<BasicTreeModel> = new Emitter();

  constructor(
    private _treeData?: IBasicTreeData[],
    private _resolveChildren?: (parent?: ICompositeTreeNode) => ITreeNodeOrCompositeTreeNode[] | null,
    private _sortComparator?: (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => number,
  ) {
    super();
    this._root = new BasicTreeRoot(this, undefined, { children: this._treeData, label: '', command: '', icon: ''});
    this._model = new BasicTreeModel();
    this._model.init(this._root);
    this.initDecorations(this._root as BasicTreeRoot);
    this.onDidUpdateTreeModelEmitter.fire(this._model);
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
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.contextMenuDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  async resolveChildren(parent?: BasicCompositeTreeNode) {
    if (this._resolveChildren) {
      return this._resolveChildren(parent);
    } else {
      return this.transformTreeNode(parent, parent?.raw.children || []);
    }
  }

  sortComparator = (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => {
    if (this._sortComparator) {
      return this._sortComparator(a, b);
    }
    return super.sortComparator(a, b);
  }

  transformTreeNode(parent?: BasicCompositeTreeNode, nodes?: IBasicTreeData[]) {
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

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeNodeDecoration = (target: BasicCompositeTreeNode | BasicTreeNode, dispatch: boolean = true) => {
    if (this.preContextMenuFocusedNode) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedNode);
      this.preContextMenuFocusedNode = null;
    }
    if (target) {
      if (this.selectedNodes.length > 0) {
        this.selectedNodes.forEach((file) => {
          // 因为选择装饰器可能通过其他方式添加而不能及时在selectedNodes上更新
          // 故这里遍历所有选中装饰器的节点进行一次统一清理
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

      // 通知视图更新
      dispatch && this.model?.dispatchChange();
    }
  }
}

export class BasicTreeModel extends TreeModel {}

export class BasicTreeRoot extends CompositeTreeNode {
  private _raw: IBasicTreeData;
  constructor(
    tree: BasicTreeService,
    parent: BasicCompositeTreeNode | undefined,
    data: IBasicTreeData,
  ) {
    super(tree, parent);
    this._raw = data;
  }

  get name() {
    return `BasicTreeRoot_${this._uid}`;
  }

  get raw() {
    return this._raw;
  }

  get expanded() {
    return true;
  }
}

export class BasicCompositeTreeNode extends CompositeTreeNode {
  private _displayName: string;
  private _whenReady: Promise<void>;
  private _raw: IBasicTreeData;

  constructor(
    tree: BasicTreeService,
    parent: BasicCompositeTreeNode | undefined,
    data: IBasicTreeData,
    id?: number,
  ) {
    super(tree, parent, undefined, {}, { disableCache: true });
    if (data.expanded) {
      this._whenReady = this.setExpanded();
    }
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    this.name = String(this._uid);
    this._displayName = data.label;
    this._raw = data;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get whenReady() {
    return this._whenReady;
  }

  get displayName() {
    return this._displayName;
  }

  get icon() {
    return this.raw.icon;
  }

  get description() {
    return this.raw.description;
  }

  get raw() {
    return this._raw;
  }
}

export class BasicTreeNode extends TreeNode {
  private _displayName: string;
  private _raw: IBasicTreeData;

  constructor(
    tree: BasicTreeService,
    parent: BasicCompositeTreeNode | undefined,
    data: IBasicTreeData,
    id?: number,
  ) {
    super(tree, parent, undefined, {}, { disableCache: true });
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    this.name = String(this._uid);
    this._displayName = data.label;
    this._raw = data;
    TreeNode.setTreeNode(this._uid, this.path, this);
  }

  get displayName() {
    return this._displayName;
  }

  get description() {
    return this.raw.description;
  }

  get icon() {
    return this.raw.icon;
  }

  get raw() {
    return this._raw;
  }
}
