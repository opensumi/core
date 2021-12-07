import { ICompositeTreeNode, ITreeNodeOrCompositeTreeNode } from '../types';
import { INodeRendererProps } from '../TreeNodeRendererWrap';
import { ClasslistComposite } from '../tree/decoration';

export enum IBasicInlineMenuPosition {
  TREE_NODE = 1,
  TREE_CONTAINER,
}

export interface IBasicInlineMenu {
  /**
   * 默认图标，可以使用框架内置的图标集
   * 也可以传入自定义的 ClassName
   */
  icon: string;
  /**
   * 菜单文本
   */
  title: string;
  /**
   * 点击菜单执行的命令
   */
  command: string;
  /**
   * 行内菜单的位置
   * TREE_NODE 代表子节点
   * TREE_CONTAINER 代表包含子节点的目录节点（菜单位于右侧）
   */
  position: IBasicInlineMenuPosition;
}

export type IBasicInlineMenuActuator = (node: ITreeNodeOrCompositeTreeNode, action: IBasicInlineMenu) => void;

export interface IBasicContextMenu {
  /**
   * 默认图标，可以使用框架内置的图标集
   * 也可以传入自定义的 ClassName
   */
  icon: string;
  /**
   * 菜单文本
   */
  title: string;
  /**
   * 点击菜单执行的命令
   */
  command: string;
}

export type IBasicContextMenuActuator = (node: ITreeNodeOrCompositeTreeNode, action: IBasicContextMenu) => void;

export interface IBasicTreeData {
  /**
   * 展示字段
   */
  label: string;
  /**
   * 图标
   */
  icon: string;
  /**
   * 描述
   */
  description?: string;
  /**
   * 子节点
   */
  children?: IBasicTreeData[] | null;
  /**
   * 是否默认展开
   */
  expanded?: boolean;
  /**
   * 其他属性
   */
  [key: string]: any;
}

export interface IBasicRecycleTreeProps {
  /**
   * 节点数据，用于渲染 Tree 的数据
   */
  treeData: IBasicTreeData[];
  /**
   * Tree 容器高度
   */
  height: number;
  /**
   * Tree 容器宽度
   * 不传入时，默认自动撑开 100% 父节点宽度
   */
  width?: number;
  /**
   * 当焦点选中时，是否高亮展示
   * 默认值为 true
   */
  outline?: boolean;
  /**
   * 目录节点是否可折叠
   * 默认值为 true
   */
  foldable?: boolean;
  /**
   * 节点高度, 默认值为 22
   */
  itemHeight?: number;
  /**
   * 追加的容器样式名，用于自定义更多样式
   */
  containerClassname?: string;
  /**
   * 追加的节点样式名，用于自定义更多样式
   */
  itemClassname?: string;
  /**
   * 当组件渲染时提供了该方法时，组件展开前会尝试使用该方法去获取需要展示的节点
   */
  resolveChildren?: (node?: ICompositeTreeNode) => ITreeNodeOrCompositeTreeNode[] | null;
  /**
   * 排序函数
   */
  sortComparator?: (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => number;
  /**
   * 单击事件
   */
  onClick?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 双击事件
   */
  onDbClick?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单事件
   */
  onContextMenu?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
    * 箭头点击事件
    */
  onTwistierClick?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单定义，但传入了 `onContextMenu` 函数时将有限执行 `onContextMenu` 函数
   */
  contextMenus?: IBasicContextMenu[] | (() => IBasicContextMenu[]);
  /**
   * 右键菜单点击的执行逻辑
   */
  contextMenuActuator?: IBasicContextMenuActuator;
  /**
   * 行内菜单定义
   */
  inlineMenus?: IBasicInlineMenu[] | (() => IBasicInlineMenu[]);
  /**
   * 行内菜单点击的执行逻辑
   */
  inlineMenuActuator?: IBasicInlineMenuActuator;
}

export interface IBasicNodeProps {
  /**
   * 节点高度
   */
  itemHeight?: number;
  /**
   * 追加样式
   */
  className?: string;
  /**
   * 节点缩进
   */
  indent?: number;
  /**
   * 节点装饰
   */
  decorations?: ClasslistComposite;
  /**
   * 单击事件
   */
  onClick?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 双击事件
   */
  onDbClick?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单事件
   */
  onContextMenu?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 箭头点击事件
   */
  onTwistierClick?: (node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单定义，但传入了 `onContextMenu` 函数时将有限执行 `onContextMenu` 函数
   */
  contextMenus?: IBasicContextMenu[] | (() => IBasicContextMenu[]);
  /**
   * 右键菜单点击的执行逻辑
   */
  contextMenuActuator?: IBasicContextMenuActuator;
  /**
   * 行内菜单定义
   */
  inlineMenus?: IBasicInlineMenu[] | (() => IBasicInlineMenu[]);
  /**
   * 行内菜单点击的执行逻辑
   */
  inlineMenuActuator?: IBasicInlineMenuActuator;
}

export type IBasicNodeRendererProps = INodeRendererProps & IBasicNodeProps;
