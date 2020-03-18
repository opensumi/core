import * as React from 'react';
import { FixedSizeList, Align } from 'react-window';
import { TreeModel } from './tree/model/tree-model';
import { TreeNode, CompositeTreeNode } from './tree';
import { RenamePromptHandle, PromptHandle } from './prompt';
import { NewPromptHandle } from './prompt/NewPromptHandle';
import { DisposableCollection, Emitter, IDisposable } from '@ali/ide-core-common';
import { INodeRendererProps, NodeType, NodeRendererWrap, INodeRenderer } from './TreeNodeRendererWrap';

export interface IModelChange {
  preModel: TreeModel;
  nextModel: TreeModel;
}

export interface IRecycleTreeProps {
  model: TreeModel;
  /**
   * 缩进大小
   * @type {number}
   * @memberof RecycleTreeProps
   */
  leftPadding?: number;
  /**
   * 搜索字符串
   * @type {string}
   * @memberof RecycleTreeProps
   */
  search?: string;
  /**
   * 替换的字符串，需配合search字段使用
   * @type {string}
   * @memberof RecycleTreeProps
   */
  replace?: string;
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

}

export interface IRecycleTreeHandle {
  // 新建节点, 相关API在调用前需确保节点无再发生变化，否则易出错
  // 如：文件树中外部文件变化同步到Tree中事件还未处理结束，此时需等待事件处理结束
  promptNewTreeNode(at: string | CompositeTreeNode): Promise<NewPromptHandle>;
  // 新建可折叠节点
  promptNewCompositeTreeNode(at: string | CompositeTreeNode): Promise<NewPromptHandle>;
  // 重命名节点
  promptRename(pathOrTreeNode: string | TreeNode | CompositeTreeNode): Promise<RenamePromptHandle>;
  // 展开节点
  expandNode(pathOrTreeNode: string | CompositeTreeNode): Promise<void>;
  // 折叠节点
  collapseNode(pathOrTreeNode: string | CompositeTreeNode): Promise<void>;
  // 定位节点位置，滚动条将会滚动到对应可视区域
  ensureVisible(pathOrTreeNode: string | TreeNode | CompositeTreeNode, align?: Align): Promise<void>;
  // 获取当前TreeModel
  getModel(): TreeModel;
  // TreeModel变更事件
  onDidChangeModel(callback: (IModelChange) => void): IDisposable;
  // Tree更新事件
  onDidUpdate(callback: () => void): IDisposable;
}

export class RecycleTree extends React.Component<IRecycleTreeProps> {

  private static BATCHED_UPDATE_MAX_DEBOUNCE_MS: number = 4;

  private _promptHandle: NewPromptHandle | RenamePromptHandle;

  private idxTorendererPropsCache: Map<number, INodeRendererProps> = new Map();
  private listRef = React.createRef<FixedSizeList>();
  private disposables: DisposableCollection = new DisposableCollection();

  private onDidUpdateEmitter: Emitter<void> = new Emitter();
  private onDidModelChangeEmitter: Emitter<IModelChange> = new Emitter();
  // 索引应该比目标折叠节点索引+1，即位于折叠节点下的首个节点
  private newPromptInsertionIndex: number = -1;
  // 目标索引
  private promptTargetID: number;

  // 批量更新Tree节点
  private batchUpdate = (() => {
    let onePromise: Promise<void>;
    let resolver;
    let timer: number;
    const commitUpdate = () => {
      const { root } = this.props.model;
      let newFilePromptInsertionIndex: number = -1;
      if (this.promptTargetID > -1 &&
        this.promptHandle instanceof NewPromptHandle &&
        this.promptHandle.parent.expanded && root.isItemVisibleAtSurface(this.promptHandle.parent) &&
        !this.promptHandle.destroyed) {
        const idx = root.getIndexAtTreeNodeId(this.promptTargetID);
        if (idx > -1 || this.promptHandle.parent === root) {
          newFilePromptInsertionIndex = idx + 1;
        } else {
          this.promptTargetID = -1;
        }
      }
      this.newPromptInsertionIndex = newFilePromptInsertionIndex;
      this.idxTorendererPropsCache.clear();
      // 更新React组件
      this.forceUpdate(resolver);
    };
    return () => {
      if (!onePromise) {
        onePromise = new Promise((res) => resolver = res);
        onePromise.then(() => {
          resolver = null;
          this.onDidUpdateEmitter.fire();
        });
      }
      // 更新批量更新返回的promise对象
      clearTimeout(timer);
      timer = setTimeout(commitUpdate, RecycleTree.BATCHED_UPDATE_MAX_DEBOUNCE_MS) as any;
      return onePromise;
    };
  })();

  public componentDidUpdate(prevProps: IRecycleTreeProps) {
    if (this.props.model !== prevProps.model) {
      this.disposables.dispose();
      const { model } = this.props;
      this.listRef.current.scrollTo(model.state.scrollOffset);
      this.disposables.push(model.onChange(this.batchUpdate));
      this.disposables.push(model.state.onDidLoadState(() => {
        this.listRef.current.scrollTo(model.state.scrollOffset);
      }));
      this.onDidModelChangeEmitter.fire({
        preModel: prevProps.model,
        nextModel: model,
      });
    }
  }

  private async promptNew(pathOrTreeNode: string | CompositeTreeNode, type: NodeType): Promise<NewPromptHandle> {
    const { root } = this.props.model;
    const node = typeof pathOrTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode)
      : pathOrTreeNode;

    if (!CompositeTreeNode.is(pathOrTreeNode)) {
      throw new TypeError(`Cannot create new prompt at object of type ${typeof node}`);
    }

    if (type !== NodeType.TreeNode && type !== NodeType.CompositeTreeNode) {
      throw new TypeError(`Invalid type supplied. Expected 'NodeType.TreeNode' or 'NodeType.CompositeTreeNode', got ${type}`);
    }

    const promptHandle = new NewPromptHandle(type, node as CompositeTreeNode);
    this.promptHandle = promptHandle;
    this.promptTargetID = node!.id;
    if (node !== root && (!(node as CompositeTreeNode).expanded || !root.isItemVisibleAtSurface(node as CompositeTreeNode))) {
      await (node as CompositeTreeNode).setExpanded(true);
    } else {
      await this.batchUpdate();
    }
    this.listRef.current.scrollToItem(this.newPromptInsertionIndex);
    return this.promptHandle as NewPromptHandle;
  }

  // 使用箭头函数绑定当前this
  private promptNewTreeNode = (pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle> => {
    return this.promptNew(pathOrTreeNode, NodeType.TreeNode);
  }

  private promptNewCompositeTreeNode = (pathOrTreeNode: string | CompositeTreeNode): Promise<NewPromptHandle> => {
    return this.promptNew(pathOrTreeNode, NodeType.CompositeTreeNode);
  }

  private promptRename = async (pathOrTreeNode: string | TreeNode): Promise<RenamePromptHandle> => {
    const { root } = this.props.model;
    const node = (typeof pathOrTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode)
      : pathOrTreeNode) as (TreeNode | CompositeTreeNode);

    if (!TreeNode.is(node) || CompositeTreeNode.isRoot(node)) {
      throw new TypeError(`Cannot rename object of type ${typeof node}`);
    }
    const promptHandle = new RenamePromptHandle(node.name, node);
    this.promptHandle = promptHandle;
    this.promptTargetID = node.id;
    if (!root.isItemVisibleAtSurface(node)) {
      await (node.parent as CompositeTreeNode).setExpanded(true);
    } else {
      await this.batchUpdate();
    }
    this.listRef.current.scrollToItem(root.getIndexAtTreeNodeId(this.promptTargetID));
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

  private ensureVisible = async (pathOrTreeNode: string | TreeNode | CompositeTreeNode, align: Align = 'auto'): Promise<void> => {
    const { root, state } = this.props.model;
    const node = typeof pathOrTreeNode === 'string'
      ? await root.forceLoadTreeNodeAtPath(pathOrTreeNode)
      : pathOrTreeNode;

    if (!TreeNode.is(node) || CompositeTreeNode.isRoot(node)) {
      throw new TypeError(`Object not a valid Node`);
    }
    if (this.scrollIntoView(node as TreeNode, align)) {
      state.excludeFromStash(node);
      return;
    }
    state.reverseStash();
    await (node.parent as CompositeTreeNode).setExpanded(true);
    this.listRef.current.scrollToItem(root.getIndexAtTreeNode(node), align);
  }

  private scrollIntoView(node: TreeNode | CompositeTreeNode, align: Align = 'center'): boolean {
    const { root } = this.props.model;
    const idx = root.getIndexAtTreeNode(node);
    if (idx > -1) {
      this.listRef.current.scrollToItem(idx, align);
      return true;
    }
    return false;
  }

  public componentDidMount() {
    const { model, onReady } = this.props;
    this.listRef.current.scrollTo(model.state.scrollOffset);
    this.disposables.push(model.onChange(this.batchUpdate));
    this.disposables.push(model.state.onDidLoadState(() => {
      this.listRef.current.scrollTo(model.state.scrollOffset);
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
    let cached = this.idxTorendererPropsCache.get(index);
    if (!cached) {
      const promptInsertionIdx = this.newPromptInsertionIndex;
      const { root } = this.props.model;
      // 存在新建输入框
      if (promptInsertionIdx > -1 &&
        this.promptHandle && this.promptHandle.constructor === NewPromptHandle &&
        !this.promptHandle.destroyed) {
        if (index === promptInsertionIdx) {
          cached = {
            itemType: NodeType.NewPrompt,
            item: this.promptHandle as NewPromptHandle,
          } as any;
        } else {
          const item = root.getTreeNodeAtIndex(index - (index >= promptInsertionIdx ? 1 : 0));
          cached = {
            itemType: CompositeTreeNode.is(item) ? NodeType.CompositeTreeNode : NodeType.TreeNode,
            item,
          } as any;
        }
      } else {
        const item = root.getTreeNodeAtIndex(index);
        // 检查是否为重命名节点
        if (item && item.id === this.promptTargetID &&
          this.promptHandle && this.promptHandle.constructor === RenamePromptHandle &&
          (this.promptHandle as RenamePromptHandle).originalFileName === item.name &&
          !this.promptHandle.destroyed) {
          cached = {
            itemType: NodeType.RenamePrompt,
            item: this.promptHandle as RenamePromptHandle,
          };
        } else {
          cached = {
            itemType: CompositeTreeNode.is(item) ? NodeType.CompositeTreeNode : NodeType.TreeNode,
            item,
          } as any;
        }
      }
      this.idxTorendererPropsCache.set(index, cached!);
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
    return (
      this.newPromptInsertionIndex > -1 &&
      this.promptHandle && this.promptHandle.constructor === NewPromptHandle &&
      !this.promptHandle.destroyed)
      ? root.branchSize + 1
      : root.branchSize;
  }

  private getItemKey = (index: number) => this.getItemAtIndex(index).item.id;

  private renderItem = ({ index, style }): JSX.Element => {
    const { children } = this.props;
    const { item, itemType: type } = this.getItemAtIndex(index);
    return <div style={style}>
      <NodeRendererWrap
        item={item}
        depth={item.depth}
        itemType={type}
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
        itemKey={this.getItemKey}
        itemCount={this.adjustedRowCount}
        overscanCount={5}
        ref={this.listRef}
        onScroll={this.handleListScroll}
        style={style}
        className={className}>
        {this.renderItem}
      </FixedSizeList>);
  }
}
