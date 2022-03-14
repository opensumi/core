import fuzzy from 'fuzzy';
import React from 'react';
import { FixedSizeList, VariableSizeList, shouldComponentUpdate, ListProps } from 'react-window';

import { ScrollbarsVirtualList } from '../scrollbars';
import { DisposableCollection, Emitter, Event, Disposable } from '../utils';

import { RenamePromptHandle, PromptHandle } from './prompt';
import { NewPromptHandle } from './prompt/NewPromptHandle';
import { TreeNode, CompositeTreeNode, spliceArray } from './tree';
import { TreeModel } from './tree/model/TreeModel';
import { INodeRendererProps, NodeRendererWrap, INodeRenderer } from './TreeNodeRendererWrap';
import { TreeNodeType, TreeNodeEvent } from './types';


export type IRecycleTreeAlign = 'smart' | 'start' | 'center' | 'end' | 'auto';

export interface IModelChange {
  preModel: TreeModel;
  nextModel: TreeModel;
}

export type IRecycleTreeOverflow = 'ellipsis' | 'auto';

export interface IRecycleTreeSize {
  width?: number;
  height: number;
}

export interface IRecycleTreeProps<T = TreeModel> {
  model: T;
  /**
   * 容器高度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  height: number;
  /**
   * 容器宽度
   * 不传默认按照 100% 宽度渲染
   * @type {number}
   * @memberof RecycleTreeProps
   */
  width?: number;
  /**
   * 节点高度
   * @type {number}
   * @memberof RecycleTreeProps
   */
  itemHeight: number;
  /**
   * Tree外部样式
   * @type {React.CSSProperties}
   * @memberof RecycleTreeProps
   */
  style?: React.CSSProperties;
  /**
   * Tree外部样式名
   * @type {string}
   * @memberof RecycleTreeProps
   */
  className?: string;
  /**
   * Tree初始化完成后会返回控制句柄
   * @memberof IRecycleTreeProps
   */
  onReady?: (handle: IRecycleTreeHandle) => void;
  /**
   * 筛选节点字段
   * 1. 路径匹配，如app/test
   * 2. 模糊匹配
   * @type {string}
   * @memberof IRecycleTreeProps
   */
  filter?: string;
  /**
   * 筛选器
   */
  filterProvider?: {
    fuzzyOptions: () => fuzzy.FilterOptions<any>;
    filterAlways?: boolean;
  };
  /**
   * 空白时的占位元素
   * @type {React.ReactNode}
   * @memberof IRecycleTreeProps
   */
  placeholder?: React.JSXElementConstructor<any>;
  /**
   * 声明文件树单行超出时的处理行为：
   * - ellipsis 展示省略号
   * - auto 撑开容器，可能会有横向滚动条
   * 默认为 ellipsis
   * @type {IRecycleTreeOverflow}
   * @memberof IRecycleTreeProps
   */
  overflow?: IRecycleTreeOverflow;
  /**
   * 声明Tree加载时预加载的节点内容
   * 主要用于避免快速滚动时出现空白区域的情况
   * 默认值为：Recycle.DEFAULT_OVER_SCAN_COUNT = 50
   * @type {number}
   * @memberof IRecycleTreeProps
   */
  overScanCount?: number;
  /**
   * 是否保留 Tree 底部空白，大小为 22 px
   * 默认值为：false
   */
  leaveBottomBlank?: boolean;
  /**
   * 指定如何获取 item key
   */
  getItemKey?: (node: INodeRendererProps) => string | number;

  /**
   * 支持根据内容动态调整高度
   * 最低不能少于 22 px
   * 默认值为: false
   *
   */
  supportDynamicHeights?: boolean;
}

export interface IRecycleTreeError {
  type: RenderErrorType;
  message: string;
}

export enum RenderErrorType {
  RENDER_ITEM,
  GET_RENDED_KEY,
  RENDER_ERROR,
}

export interface IRecycleTreeHandle {
  /**
   * 新建节点
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  promptNewTreeNode(pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle>;
  /**
   * 新建可折叠节点
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  promptNewCompositeTreeNode(pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle>;
  /**
   * 重命名节点
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  promptRename(
    pathOrTreeNode: string | TreeNode | CompositeTreeNode,
    defaultName?: string,
  ): Promise<RenamePromptHandle>;
  /**
   * 展开节点
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  expandNode(pathOrTreeNode: string | CompositeTreeNode): Promise<void>;
  /**
   * 折叠节点
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  collapseNode(pathOrTreeNode: string | CompositeTreeNode): Promise<void>;
  /**
   * 定位节点位置，滚动条将会滚动到对应可视区域，需要手动控制是否稳定后再进行节点定位
   *
   * @param pathOrTreeNode 节点或者节点路径
   * @param align IRecycleTreeAlign
   * @param untilStable 是否在节点稳定时再进行定位操作，部分Tree可能在定位过程中会有不断传入的变化，如文件树
   */
  ensureVisible(
    pathOrTreeNode: string | TreeNode | CompositeTreeNode,
    align?: IRecycleTreeAlign,
    untilStable?: boolean,
  ): Promise<TreeNode | undefined>;
  /**
   * 获取当前Tree的宽高信息
   *
   * @returns {IRecycleTreeSize}
   * @memberof IRecycleTreeHandle
   */
  getCurrentSize(): IRecycleTreeSize;
  /**
   * 获取当前TreeModel
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  getModel(): TreeModel;
  /**
   * TreeModel变更事件
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  onDidChangeModel: Event<IModelChange>;
  /**
   * Tree更新事件
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  onDidUpdate: Event<void>;
  /**
   * Tree更新事件, 仅触发一次
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  onOnceDidUpdate: Event<void>;

  /**
   * 监听渲染报错
   *
   * @param pathOrTreeNode 节点或者节点路径
   */
  onError: Event<IRecycleTreeError>;

  /**
   * 自适应每条 item 的布局（暂时只计算高度）
   */
  layoutItem: () => void;
}

interface IFilterNodeRendererProps {
  item: TreeNode;
  itemType: TreeNodeType;
  template?: React.JSXElementConstructor<any>;
}

const InnerElementType = React.forwardRef((props, ref) => {
  const { style, ...rest } = props as any;
  return (
    <div
      ref={ref!}
      style={{
        ...style,
        height: `${parseFloat(style.height) + RecycleTree.PADDING_BOTTOM_SIZE}px`,
      }}
      {...rest}
    />
  );
});

export class RecycleTree extends React.Component<IRecycleTreeProps> {
  public static PADDING_BOTTOM_SIZE = 22;
  private static DEFAULT_ITEM_HEIGHT = 22;
  private static TRY_ENSURE_VISIBLE_MAX_TIMES = 5;
  private static FILTER_FUZZY_OPTIONS = {
    pre: '<match>',
    post: '</match>',
    extract: (node: TreeNode) => node?.name || '',
  };
  private static DEFAULT_OVER_SCAN_COUNT = 50;

  private _promptHandle: NewPromptHandle | RenamePromptHandle;

  private idxToRendererPropsCache: Map<number, INodeRendererProps> = new Map();
  private dynamicSizeMap = new Map();
  private listRef = React.createRef<FixedSizeList | VariableSizeList>();
  private disposables: DisposableCollection = new DisposableCollection();

  private onErrorEmitter = new Emitter<IRecycleTreeError>();
  private onDidUpdateEmitter: Emitter<void> = new Emitter();
  private onDidModelChangeEmitter: Emitter<IModelChange> = new Emitter();
  // 索引应该比目标折叠节点索引+1，即位于折叠节点下的首个节点
  private newPromptInsertionIndex = -1;
  // 目标索引
  private promptTargetID: number;
  // 尝试定位次数
  private tryEnsureVisibleTimes: number;

  private idToFilterRendererPropsCache: Map<number, IFilterNodeRendererProps> = new Map();
  private filterFlattenBranch: number[];
  private filterFlattenBranchChildrenCache: Map<number, number[]> = new Map();
  private filterWatcherDisposeCollection = new DisposableCollection();

  private batchUpdatePromise: Promise<void> | null = null;
  private batchUpdateResolver: any;

  // 批量更新Tree节点
  private batchUpdate = (() => {
    let lastFrame: number | null;
    const commitUpdate = () => {
      // 已经在 componentWillUnMount 中 disposed 了
      if (this.disposables.disposed) {
        return;
      }

      const { root } = this.props.model;
      let newFilePromptInsertionIndex = -1;
      if (
        this.promptTargetID > -1 &&
        this.promptHandle instanceof NewPromptHandle &&
        this.promptHandle.parent &&
        this.promptHandle.parent.expanded &&
        root.isItemVisibleAtSurface(this.promptHandle.parent) &&
        !this.promptHandle.destroyed
      ) {
        const idx = root.getIndexAtTreeNodeId(this.promptTargetID);
        if (idx > -1 || this.promptHandle.parent === root) {
          // 如果新建节点类型为普通节点，则在可折叠节点后插入
          if (this.promptHandle.type === TreeNodeType.TreeNode) {
            const parent = this.promptHandle.parent;
            if (parent) {
              newFilePromptInsertionIndex = this.getNewPromptInsertIndex(idx, parent);
            } else {
              newFilePromptInsertionIndex = idx + 1;
            }
          } else {
            newFilePromptInsertionIndex = idx + 1;
          }
        } else {
          this.promptTargetID = -1;
        }
      }
      if (newFilePromptInsertionIndex === -1) {
        // 新建节点，异常情况下的特殊处理，需要把promptHandle销毁，仅需要考虑NewPromptHandle情况
        if (this.promptHandle && this.promptHandle.constructor === NewPromptHandle && !this.promptHandle.destroyed) {
          this.promptHandle.destroy();
        }
      }
      this.newPromptInsertionIndex = newFilePromptInsertionIndex;
      // 清理cache，这里可以确保分支已更新完毕
      this.idxToRendererPropsCache.clear();
      // 更新React组件
      this.forceUpdate(() => {
        this.batchUpdateResolver();
        // 如果存在过滤条件，同时筛选一下展示节点
        if (this.props.filter && this.props.filterProvider && this.props.filterProvider.filterAlways) {
          this.filterItems(this.props.filter);
        }
      });
    };
    return () => {
      // 如果上次更新队列未完成，直接使用上次更新队列作为最新结果
      if (!this.batchUpdatePromise) {
        this.batchUpdatePromise = new Promise((res) => (this.batchUpdateResolver = res));
        this.batchUpdatePromise.then(() => {
          this.batchUpdatePromise = null;
          this.batchUpdateResolver = null;
          this.onDidUpdateEmitter.fire();
        });
        // 更新批量更新返回的promise对象
        if (lastFrame) {
          window.cancelAnimationFrame(lastFrame);
        }
        lastFrame = requestAnimationFrame(commitUpdate.bind(this));
      }
      return this.batchUpdatePromise;
    };
  })();

  private getNewPromptInsertIndex(startIndex: number, parent: CompositeTreeNode) {
    const { root } = this.props.model;
    let insertIndex: number = startIndex + 1;
    // 合并文件夹以及深层级子节点
    for (; insertIndex - startIndex <= parent.branchSize; insertIndex++) {
      const node = root.getTreeNodeAtIndex(insertIndex);
      if (!node) {
        return insertIndex;
      }
      if (CompositeTreeNode.is(node)) {
        continue;
      } else if (node?.depth > parent.depth + 1) {
        continue;
      } else {
        return insertIndex;
      }
    }
    return insertIndex;
  }

  public UNSAFE_componentWillUpdate(prevProps: IRecycleTreeProps) {
    if (this.props.filter !== prevProps.filter) {
      this.filterItems(prevProps.filter!);
    }
    if (this.props.model !== prevProps.model) {
      // model变化时，在渲染前清理缓存
      this.idxToRendererPropsCache.clear();
      this.idToFilterRendererPropsCache.clear();
      this.dynamicSizeMap.clear();
    }
  }

  public componentDidUpdate(prevProps: IRecycleTreeProps) {
    if (this.props.model !== prevProps.model) {
      this.disposables.dispose();
      const { model } = this.props;
      this.listRef.current?.scrollTo(model.state.scrollOffset);
      this.disposables.push(model.onChange(this.batchUpdate));
      this.disposables.push(
        model.state.onDidLoadState(() => {
          this.listRef.current?.scrollTo(model.state.scrollOffset);
        }),
      );
      this.onDidModelChangeEmitter.fire({
        preModel: prevProps.model,
        nextModel: model,
      });
    }
  }

  private async promptNew(
    pathOrTreeNode: string | CompositeTreeNode,
    type: TreeNodeType = TreeNodeType.TreeNode,
  ): Promise<NewPromptHandle> {
    const { root } = this.props.model;
    let node = typeof pathOrTreeNode === 'string' ? await root.getTreeNodeByPath(pathOrTreeNode) : pathOrTreeNode;

    if (type !== TreeNodeType.TreeNode && type !== TreeNodeType.CompositeTreeNode) {
      throw new TypeError(
        `Invalid type supplied. Expected 'TreeNodeType.TreeNode' or 'TreeNodeType.CompositeTreeNode', got ${type}`,
      );
    }

    if (!!node && !CompositeTreeNode.is(node)) {
      // 获取的子节点如果不是CompositeTreeNode，尝试获取父级节点
      node = node.parent;
      if (!CompositeTreeNode.is(node)) {
        throw new TypeError(`Cannot create new prompt at object of type ${typeof node}`);
      }
    }
    if (!node) {
      throw new Error(`Cannot find node at ${pathOrTreeNode}`);
    }
    const promptHandle = new NewPromptHandle(type, node as CompositeTreeNode);
    this.promptHandle = promptHandle;
    this.promptTargetID = node!.id;
    if (
      node !== root &&
      (!(node as CompositeTreeNode).expanded || !root.isItemVisibleAtSurface(node as CompositeTreeNode))
    ) {
      // 调用setExpanded即会在之后调用batchUpdate函数
      await (node as CompositeTreeNode).setExpanded(true);
    } else {
      await this.batchUpdate();
    }
    if (this.newPromptInsertionIndex >= 0) {
      // 说明已在输入框已在可视区域
      this.listRef.current?.scrollToItem(this.newPromptInsertionIndex);
    } else {
      this.tryScrollIntoViewWhileStable(this.promptHandle as any);
    }

    return this.promptHandle as NewPromptHandle;
  }

  // 使用箭头函数绑定当前this
  private promptNewTreeNode = (pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle> =>
    this.promptNew(pathOrTreeNode);

  private promptNewCompositeTreeNode = (pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle> =>
    this.promptNew(pathOrTreeNode, TreeNodeType.CompositeTreeNode);

  private promptRename = async (
    pathOrTreeNode: string | TreeNode,
    defaultName?: string,
  ): Promise<RenamePromptHandle> => {
    const { root } = this.props.model;
    const node = (
      typeof pathOrTreeNode === 'string' ? await root.getTreeNodeByPath(pathOrTreeNode) : pathOrTreeNode
    ) as TreeNode | CompositeTreeNode;

    if (!TreeNode.is(node) || CompositeTreeNode.isRoot(node)) {
      throw new TypeError(`Cannot rename object of type ${typeof node}`);
    }
    const promptHandle = new RenamePromptHandle(defaultName || node.name, node);
    this.promptHandle = promptHandle;
    this.promptTargetID = node.id;
    if (!root.isItemVisibleAtSurface(node)) {
      await (node.parent as CompositeTreeNode).setExpanded(true);
    } else {
      await this.batchUpdate();
    }
    this.listRef.current?.scrollToItem(root.getIndexAtTreeNodeId(this.promptTargetID));
    return this.promptHandle as RenamePromptHandle;
  };

  private expandNode = async (pathOrCompositeTreeNode: string | CompositeTreeNode) => {
    const { root } = this.props.model;
    const directory =
      typeof pathOrCompositeTreeNode === 'string'
        ? ((await root.getTreeNodeByPath(pathOrCompositeTreeNode)) as CompositeTreeNode)
        : await root.getTreeNodeByPath(pathOrCompositeTreeNode.path);

    if (directory && CompositeTreeNode.is(directory)) {
      return (directory as CompositeTreeNode).setExpanded(true);
    }
  };

  private collapseNode = async (pathOrCompositeTreeNode: string | CompositeTreeNode) => {
    const { root } = this.props.model;
    const directory =
      typeof pathOrCompositeTreeNode === 'string'
        ? ((await root.getTreeNodeByPath(pathOrCompositeTreeNode)) as CompositeTreeNode)
        : root.getTreeNodeByPath(pathOrCompositeTreeNode.path);

    if (directory && CompositeTreeNode.is(directory)) {
      return (directory as CompositeTreeNode).setCollapsed();
    }
  };

  private _isEnsuring = false;
  private ensureVisible = async (
    pathOrTreeNode: string | TreeNode | CompositeTreeNode,
    align: IRecycleTreeAlign = 'smart',
    untilStable = false,
  ): Promise<TreeNode | undefined> => {
    if (this._isEnsuring) {
      // 同一时间段只能让一次定位节点的操作生效
      return;
    }
    this._isEnsuring = true;
    const { root } = this.props.model;
    const node =
      typeof pathOrTreeNode === 'string' ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode) : pathOrTreeNode;
    if (!TreeNode.is(node) || CompositeTreeNode.isRoot(node)) {
      // 异常
      return;
    }
    let parent = node.parent;
    while (parent) {
      if (!(parent as CompositeTreeNode).expanded) {
        await (parent as CompositeTreeNode).setExpanded(true);
      }
      parent = parent.parent;
    }
    if (untilStable) {
      this.tryScrollIntoViewWhileStable(node as TreeNode, align);
    } else {
      this.tryScrollIntoView(node as TreeNode, align);
    }
    this._isEnsuring = false;
    return node as TreeNode;
  };

  private tryScrollIntoView(node: TreeNode | CompositeTreeNode | PromptHandle, align: IRecycleTreeAlign = 'auto') {
    const { root } = this.props.model;
    if (node.constructor === NewPromptHandle && !(node as NewPromptHandle).destroyed) {
      this.listRef.current?.scrollToItem(this.newPromptInsertionIndex);
    } else if (root.isItemVisibleAtSurface(node as TreeNode | CompositeTreeNode)) {
      this.listRef.current?.scrollToItem(root.getIndexAtTreeNode(node as TreeNode | CompositeTreeNode), align);
    }
  }

  private tryScrollIntoViewWhileStable(
    node: TreeNode | CompositeTreeNode | PromptHandle,
    align: IRecycleTreeAlign = 'auto',
  ) {
    const { root } = this.props.model;
    if (this.tryEnsureVisibleTimes > RecycleTree.TRY_ENSURE_VISIBLE_MAX_TIMES) {
      this.tryEnsureVisibleTimes = 0;
      return;
    }
    Event.once(this.props.model.onChange)(async () => {
      await this.batchUpdatePromise;
      if (node.constructor === NewPromptHandle && !(node as NewPromptHandle).destroyed) {
        this.listRef.current?.scrollToItem(this.newPromptInsertionIndex);
      } else if (root.isItemVisibleAtSurface(node as TreeNode | CompositeTreeNode)) {
        this.listRef.current?.scrollToItem(root.getIndexAtTreeNode(node as TreeNode | CompositeTreeNode), align);
        this.tryEnsureVisibleTimes = 0;
      } else {
        this.tryEnsureVisibleTimes++;
        this.tryScrollIntoViewWhileStable(node, align);
      }
    });
  }

  public componentDidMount() {
    const { model, onReady } = this.props;
    this.listRef.current?.scrollTo(model.state.scrollOffset);
    this.disposables.push(model.onChange(this.batchUpdate));
    this.disposables.push(
      model.state.onDidLoadState(() => {
        this.listRef.current?.scrollTo(model.state.scrollOffset);
      }),
    );
    if (typeof onReady === 'function') {
      const api: IRecycleTreeHandle = {
        promptNewTreeNode: this.promptNewTreeNode,
        promptNewCompositeTreeNode: this.promptNewCompositeTreeNode,
        promptRename: this.promptRename,
        expandNode: this.expandNode,
        collapseNode: this.collapseNode,
        ensureVisible: this.ensureVisible,
        getModel: () => this.props.model,
        layoutItem: this.layoutItem,
        getCurrentSize: () => ({
          width: this.props.width,
          height: this.props.height,
        }),
        onDidChangeModel: this.onDidModelChangeEmitter.event,
        onDidUpdate: this.onDidUpdateEmitter.event,
        onOnceDidUpdate: Event.once(this.onDidUpdateEmitter.event),
        onError: this.onErrorEmitter.event,
      };
      onReady(api);
    }
  }

  public componentWillUnmount() {
    this.disposables.dispose();
  }

  private set promptHandle(handle: NewPromptHandle | RenamePromptHandle) {
    if (this._promptHandle === handle) {
      return;
    }
    if (this._promptHandle instanceof PromptHandle && !this._promptHandle.destroyed) {
      this._promptHandle.destroy();
    }
    handle.onDestroy(this.batchUpdate);
    this._promptHandle = handle;
  }

  private get promptHandle() {
    return this._promptHandle;
  }

  private getItemAtIndex = (index: number): INodeRendererProps => {
    const { filter } = this.props;
    if (!!filter && this.filterFlattenBranch.length > 0) {
      return this.idToFilterRendererPropsCache.get(this.filterFlattenBranch[index])! as INodeRendererProps;
    }
    let cached = this.idxToRendererPropsCache.get(index);
    if (!cached) {
      const promptInsertionIdx = this.newPromptInsertionIndex;
      const { root } = this.props.model;
      // 存在新建输入框
      if (
        promptInsertionIdx > -1 &&
        this.promptHandle &&
        this.promptHandle.constructor === NewPromptHandle &&
        !this.promptHandle.destroyed
      ) {
        if (index === promptInsertionIdx) {
          cached = {
            itemType: TreeNodeType.NewPrompt,
            item: this.promptHandle as NewPromptHandle,
          } as any;
        } else {
          const item = root.getTreeNodeAtIndex(index - (index >= promptInsertionIdx ? 1 : 0));
          cached = {
            itemType: CompositeTreeNode.is(item) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode,
            item,
          } as any;
        }
      } else {
        const item = root.getTreeNodeAtIndex(index);
        // 检查是否为重命名节点
        if (
          item &&
          item.id === this.promptTargetID &&
          this.promptHandle &&
          this.promptHandle.constructor === RenamePromptHandle &&
          !this.promptHandle.destroyed
        ) {
          cached = {
            itemType: TreeNodeType.RenamePrompt,
            item: this.promptHandle as RenamePromptHandle,
          };
        } else {
          cached = {
            itemType: CompositeTreeNode.is(item) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode,
            item,
          } as any;
        }
      }
      this.idxToRendererPropsCache.set(index, cached!);
    }
    return cached!;
  };

  private handleListScroll = ({ scrollOffset }) => {
    const { model } = this.props;
    model.state.saveScrollOffset(scrollOffset);
  };

  // 根据是否携带新建输入框计算行数
  private get adjustedRowCount() {
    const { root } = this.props.model;
    const { filter } = this.props;
    if (filter) {
      return this.filterFlattenBranch.length;
    }
    return this.newPromptInsertionIndex > -1 &&
      this.promptHandle &&
      this.promptHandle.constructor === NewPromptHandle &&
      !this.promptHandle.destroyed
      ? root.branchSize + 1
      : root.branchSize;
  }

  private getItemKey = (index: number) => {
    const node = this.getItemAtIndex(index);
    const { getItemKey } = this.props;
    const id = getItemKey ? getItemKey(node) : undefined;
    return id ?? index;
  };

  // 过滤Root节点展示
  private filterItems = (filter: string) => {
    const {
      model: { root },
      filterProvider,
    } = this.props;
    this.filterWatcherDisposeCollection.dispose();
    this.idToFilterRendererPropsCache.clear();
    if (!filter) {
      return;
    }
    const isPathFilter = /\//.test(filter);
    const idSets: Set<number> = new Set();
    const idToRenderTemplate: Map<number, any> = new Map();
    const nodes: TreeNode[] = [];
    for (let idx = 0; idx < root.branchSize; idx++) {
      const node = root.getTreeNodeAtIndex(idx)!;
      nodes.push(node as TreeNode);
    }
    if (isPathFilter) {
      nodes.forEach((node) => {
        if (node && node.path.indexOf(filter) > -1) {
          idSets.add(node.id);
          let parent = node.parent;
          // 不应包含根节点
          while (parent && !CompositeTreeNode.isRoot(parent)) {
            idSets.add(parent.id);
            parent = parent.parent;
          }
        }
      });
    } else {
      let fuzzyLists: fuzzy.FilterResult<TreeNode>[] = [];
      if (filterProvider) {
        fuzzyLists = fuzzy.filter(filter, nodes, filterProvider.fuzzyOptions());
      } else {
        fuzzyLists = fuzzy.filter(filter, nodes, RecycleTree.FILTER_FUZZY_OPTIONS);
      }

      fuzzyLists.forEach((item) => {
        const node = (item as any).original as TreeNode;
        idSets.add(node.id);
        let parent = node.parent;
        idToRenderTemplate.set(node.id, () => (
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            dangerouslySetInnerHTML={{ __html: item.string || '' }}
          ></div>
        ));
        // 不应包含根节点
        while (parent && !CompositeTreeNode.isRoot(parent)) {
          idSets.add(parent.id);
          parent = parent.parent;
        }
      });
    }

    this.filterFlattenBranch = new Array(idSets.size);
    for (let flatTreeIdx = 0, idx = 0; idx < root.branchSize; idx++) {
      const node = root.getTreeNodeAtIndex(idx);
      if (node && idSets.has(node.id)) {
        this.filterFlattenBranch[flatTreeIdx] = node.id;
        if (CompositeTreeNode.is(node)) {
          this.idToFilterRendererPropsCache.set(node.id, {
            item: node as CompositeTreeNode,
            itemType: TreeNodeType.CompositeTreeNode,
            template: idToRenderTemplate.has(node.id) ? idToRenderTemplate.get(node.id) : undefined,
          });
        } else {
          this.idToFilterRendererPropsCache.set(node.id, {
            item: node as TreeNode,
            itemType: TreeNodeType.TreeNode,
            template: idToRenderTemplate.has(node.id) ? idToRenderTemplate.get(node.id) : undefined,
          });
        }
        flatTreeIdx++;
      }
    }
    // 根据折叠情况变化裁剪filterFlattenBranch
    this.filterWatcherDisposeCollection.push(
      root.watcher.on(TreeNodeEvent.DidChangeExpansionState, (target, nowExpanded) => {
        const expandItemIndex = this.filterFlattenBranch.indexOf(target.id);
        if (!nowExpanded) {
          const collapesArray: number[] = [];
          for (let i = expandItemIndex + 1; i < this.filterFlattenBranch.length; i++) {
            const node = root.getTreeNodeById(this.filterFlattenBranch[i]);
            if (node && node.depth > target.depth) {
              collapesArray.push(node.id);
            } else {
              break;
            }
          }
          this.filterFlattenBranchChildrenCache.set(target.id, collapesArray);
          this.filterFlattenBranch = spliceArray(this.filterFlattenBranch, expandItemIndex + 1, collapesArray.length);
        } else {
          const spliceUint32Array = this.filterFlattenBranchChildrenCache.get(target.id);
          if (spliceUint32Array && spliceUint32Array.length > 0) {
            this.filterFlattenBranch = spliceArray(this.filterFlattenBranch, expandItemIndex + 1, 0, spliceUint32Array);
            this.filterFlattenBranchChildrenCache.delete(target.id);
          }
        }
      }),
    );
    this.filterWatcherDisposeCollection.push(
      Disposable.create(() => {
        this.filterFlattenBranchChildrenCache.clear();
      }),
    );
  };

  private renderItem = ({ index, style }): JSX.Element => {
    this.shouldComponentUpdate = shouldComponentUpdate.bind(this);
    const { children, overflow = 'ellipsis', supportDynamicHeights } = this.props;
    const node = this.getItemAtIndex(index) as IFilterNodeRendererProps;
    const wrapRef = React.useRef(null);
    if (!node) {
      return <></>;
    }
    const { item, itemType: type, template } = node;
    if (!item) {
      return <div style={style}></div>;
    }

    let ariaInfo;
    // ref: https://developers.google.com/web/fundamentals/accessibility/semantics-aria/aria-labels-and-relationships
    if (CompositeTreeNode.is(item)) {
      ariaInfo = {
        'aria-label': item.accessibilityInformation?.label,
        'aria-expanded': item.expanded,
        'aria-level': item.depth,
        'aria-setsize': item.parent?.children?.length,
        'aria-posinset': index,
      };
    } else if (TreeNode.is(item)) {
      ariaInfo = {
        'aria-label': item.accessibilityInformation?.label,
        'aria-level': item.depth,
        'aria-setsize': item.parent?.children?.length,
        'aria-posinset': index,
      };
    }

    const calcDynamicHeight = () => {
      if (!supportDynamicHeights) {
        return RecycleTree.DEFAULT_ITEM_HEIGHT;
      }

      let size = 0;
      if (wrapRef.current) {
        const ref = wrapRef.current as unknown as HTMLDivElement;
        size = Array.from(ref.children).reduce((pre, cur: HTMLElement) => pre + cur.getBoundingClientRect().height, 0);
      }
      if (size) {
        this.dynamicSizeMap.set(index, size);
      }

      return Math.max(size, RecycleTree.DEFAULT_ITEM_HEIGHT);
    };

    const itemStyle =
      overflow === 'ellipsis'
        ? style
        : { ...style, width: 'auto', minWidth: '100%', height: `${calcDynamicHeight()}px` };

    return (
      <div ref={wrapRef} style={itemStyle} role={item.accessibilityInformation?.role || 'treeiem'} {...ariaInfo}>
        <NodeRendererWrap
          item={item}
          depth={item.depth}
          itemType={type}
          template={template}
          hasPrompt={!!this.promptHandle && !this.promptHandle.destroyed}
          expanded={CompositeTreeNode.is(item) ? (item as CompositeTreeNode).expanded : void 0}
        >
          {children as INodeRenderer}
        </NodeRendererWrap>
      </div>
    );
  };

  private layoutItem = () => {
    if (!this.props.supportDynamicHeights) {
      return;
    }

    if (this.listRef && this.listRef.current && '_getRangeToRender' in this.listRef.current) {
      // _getRangeToRender 是 react-window 的内部方法，用于获取可视区域的下标范围
      // @ts-ignore
      const range = this.listRef.current._getRangeToRender();
      if (range) {
        const start = range[0];
        const end = range[1];
        Array.from({ length: end - start }).forEach((_, i) => {
          (this.listRef.current as VariableSizeList<any>).resetAfterIndex(start + i);
        });
      }
    }
  };

  private getItemSize(index: number) {
    return this.dynamicSizeMap.get(index) || this.props.itemHeight;
  }

  public render() {
    const {
      children,
      itemHeight,
      width = '100%',
      height,
      style,
      className,
      placeholder,
      overScanCount,
      leaveBottomBlank,
      supportDynamicHeights,
    } = this.props;

    if (placeholder && this.adjustedRowCount === 0) {
      const Placeholder = placeholder;
      return <Placeholder />;
    }
    const addonProps: { [key in keyof ListProps]: any } = {
      children,
      height,
      width,
      itemData: [],
      itemCount: this.adjustedRowCount,
      itemKey: this.getItemKey,
      overscanCount: overScanCount || RecycleTree.DEFAULT_OVER_SCAN_COUNT,
      onScroll: this.handleListScroll,
      style: {
        transform: 'translate3d(0px, 0px, 0px)',
        ...style,
      },
      className,
      outerElementType: ScrollbarsVirtualList,
    };
    if (leaveBottomBlank) {
      addonProps.innerElementType = InnerElementType;
    }

    return supportDynamicHeights ? (
      <VariableSizeList
        ref={this.listRef as React.RefObject<VariableSizeList>}
        itemSize={this.getItemSize.bind(this)}
        {...addonProps}
      >
        {this.renderItem}
      </VariableSizeList>
    ) : (
      <FixedSizeList ref={this.listRef as React.RefObject<FixedSizeList>} itemSize={itemHeight} {...addonProps}>
        {this.renderItem}
      </FixedSizeList>
    );
  }
}
