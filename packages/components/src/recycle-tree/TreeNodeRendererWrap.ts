import * as React from 'react';
import { TreeNode, CompositeTreeNode } from './tree/TreeNode';
import { RenamePromptHandle, NewPromptHandle } from './prompt';
import { TreeNodeType } from './types';

interface ITreeNodeRendererProps {
  item: TreeNode;
  itemType: TreeNodeType.TreeNode;
}

interface ICompositeTreeNodeRendererProps {
  item: CompositeTreeNode;
  itemType: TreeNodeType.CompositeTreeNode;
}

interface INewPromptRendererProps {
  item: NewPromptHandle;
  itemType: TreeNodeType.NewPrompt;
}

interface IRenamePromptRendererProps {
  item: RenamePromptHandle;
  itemType: TreeNodeType.RenamePrompt;
}

export type INodeRendererProps = ITreeNodeRendererProps | ICompositeTreeNodeRendererProps | INewPromptRendererProps | IRenamePromptRendererProps;

export type INodeRenderer = (props: INodeRendererProps) => JSX.Element;

export interface INodeRendererWrapProps {
  item: TreeNode | CompositeTreeNode | NewPromptHandle | RenamePromptHandle;
  itemType: TreeNodeType;
  depth: number;
  expanded?: boolean;
  children: INodeRenderer;
}

export class NodeRendererWrap extends React.Component<INodeRendererWrapProps> {

  // private lastItemPath: string;

  public render() {
    const { item, itemType, children } = this.props;
    return React.createElement(children, {item, itemType});
  }

  public shouldComponentUpdate(nextProps: INodeRendererWrapProps) {
    // 判断节点需不需要更新
    // TODO: 区分forceUpdate及普通更新，优化性能
    return true;
  }

  // public componentDidMount() {
  //   this.updateCachedItemPath();
  // }

  // public componentDidUpdate(prevProps: INodeRendererWrapProps) {
  //   this.updateCachedItemPath();
  // }

  public componentWillUnmount() {
    // do dispose
  }

  // private updateCachedItemPath() {
  //   const thisItem: TreeNode | null = this.props.itemType === TreeNodeType.TreeNode || this.props.itemType === TreeNodeType.CompositeTreeNode
  //     ? this.props.item as TreeNode
  //     : this.props.itemType === TreeNodeType.RenamePrompt
  //       ? (this.props.item as RenamePromptHandle).target
  //       : this.props.itemType === TreeNodeType.NewPrompt
  //         ? (this.props.item as NewPromptHandle).parent
  //         : null;
  //   if (thisItem && thisItem.path) {
  //     this.lastItemPath = thisItem.path;
  //   }
  // }
}
