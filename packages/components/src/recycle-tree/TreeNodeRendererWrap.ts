import React from 'react';

import { RenamePromptHandle, NewPromptHandle } from './prompt';
import { TreeNode, CompositeTreeNode } from './tree/TreeNode';
import { TreeNodeType } from './types';

export interface ITreeNodeRendererProps {
  item: TreeNode;
  itemType: TreeNodeType.TreeNode;
}

export interface ICompositeTreeNodeRendererProps {
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

export type INodeRendererProps =
  | ITreeNodeRendererProps
  | ICompositeTreeNodeRendererProps
  | INewPromptRendererProps
  | IRenamePromptRendererProps;

export type INodeRenderer = (props: any) => JSX.Element;

export interface INodeRendererWrapProps {
  item: TreeNode | CompositeTreeNode | NewPromptHandle | RenamePromptHandle;
  itemType: TreeNodeType;
  template?: React.JSXElementConstructor<any>;
  depth: number;
  expanded?: boolean;
  hasPrompt?: boolean;
  children: INodeRenderer;
}

export class NodeRendererWrap extends React.Component<INodeRendererWrapProps> {
  public render() {
    const { item, itemType, children, template, hasPrompt } = this.props;
    return React.createElement(children, { item, itemType, template, hasPrompt, key: item.id });
  }

  public shouldComponentUpdate(nextProps: INodeRendererWrapProps) {
    // 判断节点需不需要更新
    // TODO: 区分forceUpdate及普通更新，优化性能
    return true;
  }
}
