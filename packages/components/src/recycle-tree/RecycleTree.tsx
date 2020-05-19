import * as React from 'react';
import { FixedSizeList, Align } from 'react-window';
import { TreeModel } from './tree/model/TreeModel';
import { TreeNode, CompositeTreeNode, spliceTypedArray } from './tree';
import { RenamePromptHandle, PromptHandle } from './prompt';
import { NewPromptHandle } from './prompt/NewPromptHandle';
import { DisposableCollection, Emitter, Event } from '@ali/ide-core-common';
import { INodeRendererProps, NodeRendererWrap, INodeRenderer } from './TreeNodeRendererWrap';
import { TreeNodeType, TreeNodeEvent } from './types';
import { Scrollbars } from 'react-custom-scrollbars';
import * as styles from './recycle-tree.module.less';
import * as cls from 'classnames';
import * as fuzzy from 'fuzzy';

export interface IModelChange {
  preModel: TreeModel;
  nextModel: TreeModel;
}

export interface IRecycleTreeProps {
  model: TreeModel;
  /**
   * 容器高度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  height: number;
  /**
   * 容器宽度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  width: number;
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
}

export interface IRecycleTreeError {
  type: RenderErrorType;
  message: string;
}

export enum RenderErrorType {
  RENDER_ITEM,
  GET_RENDED_KEY,
}

export interface IRecycleTreeHandle {
  // 新建节点, 相关API在调用前需确保节点无再发生变化，否则易出错
  // 如：文件树中外部文件变化同步到Tree中事件还未处理结束，此时需等待事件处理结束
  promptNewTreeNode(at: string | CompositeTreeNode): Promise<NewPromptHandle>;
  // 新建可折叠节点
  promptNewCompositeTreeNode(at: string | CompositeTreeNode): Promise<NewPromptHandle>;
  // 重命名节点
  promptRename(pathOrTreeNode: string | TreeNode | CompositeTreeNode, defaultName?: string): Promise<RenamePromptHandle>;
  // 展开节点
  expandNode(pathOrTreeNode: string | CompositeTreeNode): Promise<void>;
  // 折叠节点
  collapseNode(pathOrTreeNode: string | CompositeTreeNode): Promise<void>;
  // 定位节点位置，滚动条将会滚动到对应可视区域
  ensureVisible(pathOrTreeNode: string | TreeNode | CompositeTreeNode, align?: Align): Promise<TreeNode | undefined>;
  // 获取当前TreeModel
  getModel(): TreeModel;
  // TreeModel变更事件
  onDidChangeModel: Event<IModelChange>;
  // Tree更新事件
  onDidUpdate: Event<void>;
  // 监听渲染报错
  onError: Event<IRecycleTreeError>;
}

interface IFilterNodeRendererProps {
  item: TreeNode;
  itemType: TreeNodeType;
  template?: React.JSXElementConstructor<any>;
}

interface ICustomScrollbarProps {
  forwardedRef: any;
  onScroll?: any;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

const CustomScrollbars = ({ onScroll, forwardedRef, style, children, className }: ICustomScrollbarProps) => {
  const refSetter = React.useCallback((scrollbarsRef) => {
    if (scrollbarsRef) {
      forwardedRef(scrollbarsRef.view);
    } else {
      forwardedRef(null);
    }
  }, []);

  let shadowTopRef: HTMLDivElement | null;

  const handleUpdate = (values) => {
    const { scrollTop } = values;
    const shadowTopOpacity = 1 / 20 * Math.min(scrollTop, 20);
    if (shadowTopRef) {
      shadowTopRef.style.opacity = String(shadowTopOpacity);
    }
  };

  return (
    <Scrollbars
      ref={refSetter}
      style={{...style, overflow: 'hidden'}}
      className={className}
      onUpdate={handleUpdate}
      onScroll={onScroll}
      renderThumbVertical={({ style, ...props }) =>
        <div {...props} className={styles.scrollbar_thumb_vertical}/>
      }
      renderThumbHorizontal={({ style, ...props }) =>
        <div {...props} className={styles.scrollbar_thumb_horizontal}/>
      }
      >
      <div
        ref={(ref) => { shadowTopRef = ref; }}
        className={styles.scrollbar_decoration}/>
      {children}
    </Scrollbars>
  );
};

const CustomScrollbarsVirtualList = React.forwardRef((props, ref) => (
  <CustomScrollbars {...props} forwardedRef={ref} />
));

export class RecycleTree extends React.Component<IRecycleTreeProps> {

  private static BATCHED_UPDATE_MAX_DEBOUNCE_MS: number = 4;
  private static TRY_ENSURE_VISIBLE_MAX_TIMES: number = 5;
  private static FILTER_FUZZY_OPTIONS = {
    pre: '<match>',
    post: '</match>',
    extract: (node: TreeNode) => {
      return node.name;
    },
  };

  private _promptHandle: NewPromptHandle | RenamePromptHandle;

  private idxToRendererPropsCache: Map<number, INodeRendererProps> = new Map();
  private listRef = React.createRef<FixedSizeList>();
  private disposables: DisposableCollection = new DisposableCollection();

  private onErrorEmitter = new Emitter<IRecycleTreeError>();
  private onDidUpdateEmitter: Emitter<void> = new Emitter();
  private onDidModelChangeEmitter: Emitter<IModelChange> = new Emitter();
  // 索引应该比目标折叠节点索引+1，即位于折叠节点下的首个节点
  private newPromptInsertionIndex: number = -1;
  // 目标索引
  private promptTargetID: number;

  private idToFilterRendererPropsCache: Map<number, IFilterNodeRendererProps> = new Map();
  private filterFlattenBranch: Uint32Array;
  private filterFlattenBranchChildrenCache: Map<number, Uint32Array> = new Map();
  private filterWatcherDisposeCollection = new DisposableCollection();

  private batchUpdatePromise: Promise<void> | null = null;
  private batchUpdateResolver: any;
  private tryEnsureVisibleTimes: number = 0;

  // 批量更新Tree节点
  private batchUpdate = (() => {
    let timer: number;
    const commitUpdate = () => {
      const { root } = this.props.model;
      let newFilePromptInsertionIndex: number = -1;
      if (this.promptTargetID > -1 &&
        this.promptHandle instanceof NewPromptHandle &&
        this.promptHandle.parent &&
        this.promptHandle.parent.expanded &&
        root.isItemVisibleAtSurface(this.promptHandle.parent) &&
        !this.promptHandle.destroyed
      ) {
        const idx = root.getIndexAtTreeNodeId(this.promptTargetID);
        if (idx > -1 || this.promptHandle.parent === root ) {
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
      this.newPromptInsertionIndex = newFilePromptInsertionIndex;
      // 清理cache，这里可以确保分支已更新完毕
      this.idxToRendererPropsCache.clear();
      // 更新React组件
      this.forceUpdate(this.batchUpdateResolver);
    };
    return () => {
      if (!this.batchUpdatePromise) {
        this.batchUpdatePromise = new Promise((res) => this.batchUpdateResolver = res);
        this.batchUpdatePromise.then(() => {
          this.batchUpdatePromise = null;
          this.batchUpdateResolver = null;
          this.onDidUpdateEmitter.fire();
        });
      } else {
        return this.batchUpdatePromise;
      }
      // 更新批量更新返回的promise对象
      clearTimeout(timer);
      timer = setTimeout(commitUpdate, RecycleTree.BATCHED_UPDATE_MAX_DEBOUNCE_MS) as any;
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
  }

  public componentDidUpdate(prevProps: IRecycleTreeProps) {
    if (this.props.model !== prevProps.model) {
      this.disposables.dispose();
      const { model } = this.props;
      this.listRef.current!.scrollTo(model.state.scrollOffset);
      this.disposables.push(model.onChange(this.batchUpdate));
      this.disposables.push(model.state.onDidLoadState(() => {
        this.listRef.current!.scrollTo(model.state.scrollOffset);
      }));
      this.onDidModelChangeEmitter.fire({
        preModel: prevProps.model,
        nextModel: model,
      });
    }
  }

  private async promptNew(pathOrTreeNode: string | CompositeTreeNode, type: TreeNodeType = TreeNodeType.TreeNode): Promise<NewPromptHandle> {
    const { root } = this.props.model;
    let node = typeof pathOrTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode)
      : pathOrTreeNode;

    if (type !== TreeNodeType.TreeNode && type !== TreeNodeType.CompositeTreeNode) {
      throw new TypeError(`Invalid type supplied. Expected 'TreeNodeType.TreeNode' or 'TreeNodeType.CompositeTreeNode', got ${type}`);
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
    if (node !== root && (!(node as CompositeTreeNode).expanded || !root.isItemVisibleAtSurface(node as CompositeTreeNode))) {
      // 调用setExpanded即会在之后调用batchUpdate函数
      await (node as CompositeTreeNode).setExpanded(true);
    } else {
      await this.batchUpdate();
    }
    if (this.newPromptInsertionIndex >= 0) {
      // 说明已在输入框已在可视区域
      this.listRef.current!.scrollToItem(this.newPromptInsertionIndex);
    } else {
      this.tryScrollIntoViewWhileStable(this.promptHandle as any);
    }

    return this.promptHandle as NewPromptHandle;
  }

  // 使用箭头函数绑定当前this
  private promptNewTreeNode = (pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle> => {
    return this.promptNew(pathOrTreeNode);
  }

  private promptNewCompositeTreeNode = (pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle> => {
    return this.promptNew(pathOrTreeNode, TreeNodeType.CompositeTreeNode);
  }

  private promptRename = async (pathOrTreeNode: string | TreeNode, defaultName?: string): Promise<RenamePromptHandle> => {
    const { root } = this.props.model;
    const node = (typeof pathOrTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode)
      : pathOrTreeNode) as (TreeNode | CompositeTreeNode);

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
    this.listRef.current!.scrollToItem(root.getIndexAtTreeNodeId(this.promptTargetID));
    return this.promptHandle as RenamePromptHandle;
  }

  private expandNode = async (pathOrCompositeTreeNode: string | CompositeTreeNode) => {
    const { root } = this.props.model;
    const directory: CompositeTreeNode = typeof pathOrCompositeTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrCompositeTreeNode) as CompositeTreeNode
      : pathOrCompositeTreeNode;

    if (directory && CompositeTreeNode.is(directory)) {
      return directory.setExpanded(true);
    }
  }

  private collapseNode = async (pathOrCompositeTreeNode: string | CompositeTreeNode) => {
    const { root } = this.props.model;
    const directory: CompositeTreeNode = typeof pathOrCompositeTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrCompositeTreeNode) as CompositeTreeNode
      : pathOrCompositeTreeNode;

    if (directory && CompositeTreeNode.is(directory)) {
      return directory.setCollapsed();
    }
  }

  private ensureVisible = async (pathOrTreeNode: string | TreeNode | CompositeTreeNode, align: Align = 'center'): Promise<TreeNode | undefined> => {
    const { root, state } = this.props.model;
    const node = typeof pathOrTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode)
      : pathOrTreeNode;

    if (!TreeNode.is(node) || CompositeTreeNode.isRoot(node)) {
      // 异常
      return;
    }
    if (this.scrollIntoView(node as TreeNode, align)) {
      state.excludeFromStash(node);
      return node as TreeNode;
    }
    state.reverseStash();
    let parent = node.parent;
    while (parent) {
      if (!(parent as CompositeTreeNode).expanded) {
        await (parent as CompositeTreeNode).setExpanded(true);
      }
      parent = parent.parent;
    }
    this.tryScrollIntoViewWhileStable(node as TreeNode, align);
    return node as TreeNode;
  }

  private tryScrollIntoViewWhileStable(node: TreeNode | CompositeTreeNode, align: Align = 'center') {
    const { root } = this.props.model;
    if (this.tryEnsureVisibleTimes > RecycleTree.TRY_ENSURE_VISIBLE_MAX_TIMES) {
      this.tryEnsureVisibleTimes = 0;
      return;
    }
    Event.once(this.props.model.onChange)(() => {
      if (root.isItemVisibleAtSurface(node)) {
        this.listRef.current!.scrollToItem(root.getIndexAtTreeNode(node), align);
        this.tryEnsureVisibleTimes = 0;
      } else {
        this.tryEnsureVisibleTimes ++;
        this.tryScrollIntoViewWhileStable(node, align);
      }
    });
  }

  private scrollIntoView(node: TreeNode | CompositeTreeNode, align: Align = 'center'): boolean {
    const { root } = this.props.model;
    const idx = root.getIndexAtTreeNode(node);
    if (idx > -1) {
      this.listRef.current!.scrollToItem(idx, align);
      return true;
    }
    return false;
  }

  public componentDidMount() {
    const { model, onReady } = this.props;
    this.listRef.current!.scrollTo(model.state.scrollOffset);
    this.disposables.push(model.onChange(this.batchUpdate));
    this.disposables.push(model.state.onDidLoadState(() => {
      this.listRef.current!.scrollTo(model.state.scrollOffset);
    }));
    if (typeof onReady === 'function') {
      const api: IRecycleTreeHandle = {
        promptNewTreeNode: this.promptNewTreeNode,
        promptNewCompositeTreeNode: this.promptNewCompositeTreeNode,
        promptRename: this.promptRename,
        expandNode: this.expandNode,
        collapseNode: this.collapseNode,
        ensureVisible: this.ensureVisible,
        getModel: () => this.props.model,
        onDidChangeModel: this.onDidModelChangeEmitter.event,
        onDidUpdate: this.onDidUpdateEmitter.event,
        onError: this.onErrorEmitter.event,
      };

      onReady(api);
    }
  }

  public componentWillUnmount() {
    this.disposables.dispose();
  }

  private set promptHandle(handle: NewPromptHandle | RenamePromptHandle) {
    if (this._promptHandle === handle) { return; }
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
      if (promptInsertionIdx > -1 &&
        this.promptHandle && this.promptHandle.constructor === NewPromptHandle &&
        !this.promptHandle.destroyed) {
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
        if (item &&
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
  }

  private handleListScroll = ({ scrollOffset }) => {
    const { model } = this.props;
    model.state.saveScrollOffset(scrollOffset);
  }

  // 根据是否携带新建输入框计算行数
  private get adjustedRowCount() {
    const { root } = this.props.model;
    const { filter } = this.props;
    if (!!filter) {
      return this.filterFlattenBranch.length;
    }
    return (
      this.newPromptInsertionIndex > -1 &&
      this.promptHandle && this.promptHandle.constructor === NewPromptHandle &&
      !this.promptHandle.destroyed)
      ? root.branchSize + 1
      : root.branchSize;
  }

  private getItemKey = (index: number) => {
    const node = this.getItemAtIndex(index);
    if (node && node.item) {
      if (!node.item.id) {
        // FIXME: 不清楚啥时候能复现无Item情况
        this.onErrorEmitter.fire({type: RenderErrorType.GET_RENDED_KEY, message: `Can\'t get item at index ${index}`});
        return index;
      }
      return node.item.id;
    } else {
      return index;
    }
  }

  // 过滤Root节点展示
  private filterItems = (filter: string) => {
    const { root } = this.props.model;
    this.filterWatcherDisposeCollection.dispose();
    this.idToFilterRendererPropsCache.clear();
    if (!filter) {
      return;
    }
    const isPathFilter = /\//.test(filter);
    const idSets: Set<number> = new Set();
    const idToRenderTemplate: Map<number, any> = new Map();
    const nodes: TreeNode[] = [];
    for (let idx = 0; idx < root.branchSize; idx ++) {
      nodes.push(root.getTreeNodeAtIndex(idx)!);
    }
    if (isPathFilter) {
      nodes.forEach((node) => {
        if (node && node.path.indexOf(filter) > -1) {
          idSets.add(node.id);
          let parent = node.parent;
          // 不应包含根节点
          while (parent && !CompositeTreeNode.isRoot(parent)) {
            idSets.add(parent.id);
            parent  = parent.parent;
          }
        }
      });
    } else {
      const fuzzyLists = fuzzy.filter(filter, nodes, RecycleTree.FILTER_FUZZY_OPTIONS);
      fuzzyLists.forEach((item) => {
        const node = (item as any).original as TreeNode;
        idSets.add(node.id);
        let parent = node.parent;
        idToRenderTemplate.set(node.id, () => {
          return <div style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} dangerouslySetInnerHTML={{ __html: item.string || ''}}></div>;
        });
        // 不应包含根节点
        while (parent && !CompositeTreeNode.isRoot(parent)) {
          idSets.add(parent.id);
          parent  = parent.parent;
        }
      });
    }

    this.filterFlattenBranch = new Uint32Array(idSets.size);
    for (let flatTreeIdx = 0, idx = 0; idx < root.branchSize; idx ++) {
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
            item: node,
            itemType: TreeNodeType.TreeNode,
            template: idToRenderTemplate.has(node.id) ? idToRenderTemplate.get(node.id) : undefined,
          });
        }
        flatTreeIdx ++;
      }
    }
    // 根据折叠情况变化裁剪filterFlattenBranch
    this.filterWatcherDisposeCollection.push(root.watcher.on(TreeNodeEvent.DidChangeExpansionState, (target, nowExpanded) => {
      const expandItemIndex = this.filterFlattenBranch.indexOf(target.id);
      if (!nowExpanded) {
        const spliceArray: number[] = [];
        let spliceUint32Array: Uint32Array;
        for (let i = expandItemIndex + 1; i < this.filterFlattenBranch.length; i++) {
          const node = root.getTreeNodeById(this.filterFlattenBranch[i]);
          if (node && node.depth > target.depth) {
            spliceArray.push(node.id);
          } else {
            break;
          }
        }
        spliceUint32Array = Uint32Array.from(spliceArray);
        this.filterFlattenBranchChildrenCache.set(target.id, spliceUint32Array);
        this.filterFlattenBranch = spliceTypedArray(this.filterFlattenBranch, expandItemIndex + 1, spliceUint32Array.length);
      } else {
        const  spliceUint32Array = this.filterFlattenBranchChildrenCache.get(target.id);
        if (spliceUint32Array && spliceUint32Array.length > 0) {
          this.filterFlattenBranch = spliceTypedArray(this.filterFlattenBranch, expandItemIndex + 1, 0, spliceUint32Array);
          this.filterFlattenBranchChildrenCache.delete(target.id);
        }
      }
    }));
  }

  private renderItem = ({ index, style }): JSX.Element => {
    const { children } = this.props;
    const node = this.getItemAtIndex(index) as IFilterNodeRendererProps;
    const { item, itemType: type, template } = node;
    if (!item) {
      this.onErrorEmitter.fire({type: RenderErrorType.RENDER_ITEM, message: `RenderItem error at index ${index}`});
      return <div style={style}></div>;
    }
    return <div style={style}>
      <NodeRendererWrap
        item={item}
        depth={item.depth}
        itemType={type}
        template={template}
        expanded={CompositeTreeNode.is(item) ? (item as CompositeTreeNode).expanded : void 0}>
        {children as INodeRenderer}
      </NodeRendererWrap>
    </div>;
  }

  public render() {
    const {
      itemHeight,
      width,
      height,
      style,
      className,
    } = this.props;
    return (
      <FixedSizeList
        width={width}
        height={height}
        // 这里的数据不是必要的，主要用于在每次更新列表
        itemData={[]}
        itemSize={itemHeight}
        itemCount={this.adjustedRowCount}
        getItemKey={this.getItemKey}
        overscanCount={10}
        ref={this.listRef}
        onScroll={this.handleListScroll}
        style={style}
        className={cls(className, styles.recycle_tree)}
        outerElementType={CustomScrollbarsVirtualList}>
        {this.renderItem}
      </FixedSizeList>);
  }
}
