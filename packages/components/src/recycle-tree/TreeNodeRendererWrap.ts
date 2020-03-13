import * as React from 'react';
import { TreeNode, CompositeTreeNode } from './tree/TreeNode';
import { RenamePromptHandle, NewPromptHandle } from './prompt';

// 新增了新的Input节点类型
export enum NodeType {
  TreeNode = 1,
  CompositeTreeNode,
  NewPrompt,
  RenamePrompt,
}

interface ITreeNodeRendererProps {
  item: TreeNode;
  itemType: NodeType.TreeNode;
}

interface ICompositeTreeNodeRendererProps {
  item: CompositeTreeNode;
  itemType: NodeType.CompositeTreeNode;
}

interface INewPromptRendererProps {
  item: NewPromptHandle;
  itemType: NodeType.NewPrompt;
}

interface IRenamePromptRendererProps {
  item: RenamePromptHandle;
  itemType: NodeType.RenamePrompt;
}

export type INodeRendererProps = ITreeNodeRendererProps | ICompositeTreeNodeRendererProps | INewPromptRendererProps | IRenamePromptRendererProps;

export type INodeRenderer = (props: INodeRendererProps) => JSX.Element;

export interface INodeRendererWrapProps {
  item: TreeNode | CompositeTreeNode | NewPromptHandle | RenamePromptHandle;
  itemType: NodeType;
  depth: number;
  expanded?: boolean;
  children: INodeRenderer;
}

export class NodeRendererWrap extends React.Component<INodeRendererWrapProps> {

  private lastItemPath: string;

  public render() {
    const { item, itemType, children } = this.props;
    return React.createElement(children, {item, itemType});
  }

  public shouldComponentUpdate(nextProps: INodeRendererWrapProps) {
    // 判断节点需不需要更新
    if (nextProps.item !== this.props.item ||
      nextProps.expanded !== this.props.expanded ||
      nextProps.depth !== this.props.depth ||
      nextProps.itemType !== this.props.itemType ||
      nextProps.children !== this.props.children) {
      return true;
    }

    const nextItem: TreeNode | null = nextProps.itemType === NodeType.TreeNode || nextProps.itemType === NodeType.CompositeTreeNode
      ? nextProps.item as TreeNode
      : nextProps.itemType === NodeType.RenamePrompt
        ? (nextProps.item as RenamePromptHandle).target
        : nextProps.itemType === NodeType.NewPrompt
          ? (nextProps.item as NewPromptHandle).parent
          : null;

    if ((nextItem && nextItem.path) !== this.lastItemPath) {
      return true;
    }
    return false;
  }

  public componentDidMount() {
    this.updateCachedItemPath();
  }

  public componentDidUpdate(prevProps: INodeRendererWrapProps) {
    this.updateCachedItemPath();
  }

  public componentWillUnmount() {
    // do dispose
  }

  private updateCachedItemPath() {
    const thisItem: TreeNode | null = this.props.itemType === NodeType.TreeNode || this.props.itemType === NodeType.CompositeTreeNode
      ? this.props.item as TreeNode
      : this.props.itemType === NodeType.RenamePrompt
        ? (this.props.item as RenamePromptHandle).target
        : this.props.itemType === NodeType.NewPrompt
          ? (this.props.item as NewPromptHandle).parent
          : null;
    if (thisItem && thisItem.path) {
      this.lastItemPath = thisItem.path;
    }
  }
}
