import { IRecycleTreeHandle } from '../RecycleTree';
import { ClasslistComposite } from '../tree/decoration';
import { INodeRendererProps } from '../TreeNodeRendererWrap';
import { ITreeNodeOrCompositeTreeNode } from '../types';

import type { BasicCompositeTreeNode, BasicTreeNode } from './tree-node.define';

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
   * 菜单文本
   */
  title: string;
  /**
   * 菜单唯一 ID
   */
  id: string;
  /**
   * 分组标识
   */
  group?: string;
}

/**
 * 这里的 ID 为命令传入的 ID
 */
export type IBasicContextMenuActuator = (node: ITreeNodeOrCompositeTreeNode, id: string) => void;

export interface IBasicTreeData {
  /**
   * 展示字段
   */
  label: string;
  /**
   * 图标
   */
  icon?: string;
  iconClassName?: string;
  /**
   * 描述
   */
  description?: string;
  /**
   * 子节点
   *
   * 传入一个空数组可让本节点视为文件夹，同时可以通过 expandable 属性来设置是否展示收起图标
   */
  children?: IBasicTreeData[] | null;
  /**
   * 是否默认展开
   */
  expanded?: boolean;
  /**
   * 是否可展开，若为 false 则不显示展开收起图标
   */
  expandable?: boolean;
  /**
   * 用于排序的字符串，若为空则默认以 label 作排序
   */
  sortText?: string | null;
  /**
   * 其他属性
   */
  [key: string]: any;
}

export interface IBasicRecycleTreeHandle extends IRecycleTreeHandle {
  selectItem: (item: BasicCompositeTreeNode | BasicTreeNode) => Promise<void>;
  focusItem(path: string): Promise<void>;
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
   * 节点高度, 默认值为 22
   */
  itemHeight?: number;
  /**
   * 每层的节点缩进长度，默认值为 8
   */
  indent?: number;
  /**
   * 基础缩进。即第一层距离左边的距离，默认为 8
   */
  baseIndent?: number;
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
  resolveChildren?: (node?: IBasicTreeData) => IBasicTreeData[] | null;
  /**
   * 排序函数
   */
  sortComparator?: (a: IBasicTreeData, b: IBasicTreeData) => number | undefined;
  /**
   * 单击事件
   */
  onClick?: (event: React.MouseEvent, node?: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 双击事件
   */
  onDbClick?: (event: React.MouseEvent, node?: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单事件
   */
  onContextMenu?: (event: React.MouseEvent, node?: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 箭头点击事件
   */
  onTwistierClick?: (event: React.MouseEvent, node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单定义，但传入了 `onContextMenu` 函数时将有限执行 `onContextMenu` 函数
   */
  contextMenus?: IBasicContextMenu[] | ((node: ITreeNodeOrCompositeTreeNode) => IBasicContextMenu[]);
  /**
   * 右键菜单点击的执行逻辑
   */
  contextMenuActuator?: IBasicContextMenuActuator;
  /**
   * 行内菜单定义
   */
  inlineMenus?: IBasicInlineMenu[] | ((node: ITreeNodeOrCompositeTreeNode) => IBasicInlineMenu[]);
  /**
   * 行内菜单点击的执行逻辑
   */
  inlineMenuActuator?: IBasicInlineMenuActuator;
  /**
   * 用于挂载 Tree 上的一些操作方法
   * 如：ensureVisible 等
   */
  onReady?: (treeHandler: IBasicRecycleTreeHandle) => void;

  /**
   * 指定 RecycleTree 的名字
   */
  treeName?: string;

  getItemClassName?: (item?: ITreeNodeOrCompositeTreeNode) => string | undefined;
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
   * 每层的节点缩进长度
   */
  indent?: number;
  /**
   * 节点装饰
   */
  decorations?: ClasslistComposite;
  /**
   * 单击事件
   */
  onClick?: (event: React.MouseEvent, node?: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 双击事件
   */
  onDbClick?: (event: React.MouseEvent, node?: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单事件
   */
  onContextMenu?: (event: React.MouseEvent, node?: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 箭头点击事件
   */
  onTwistierClick?: (event: React.MouseEvent, node: ITreeNodeOrCompositeTreeNode) => void;
  /**
   * 右键菜单定义，但传入了 `onContextMenu` 函数时将优先执行 `onContextMenu` 函数
   */
  contextMenus?: IBasicContextMenu[] | ((node: ITreeNodeOrCompositeTreeNode) => IBasicContextMenu[]);
  /**
   * 右键菜单点击的执行逻辑
   */
  contextMenuActuator?: IBasicContextMenuActuator;
  /**
   * 行内菜单定义
   */
  inlineMenus?: IBasicInlineMenu[] | ((node: ITreeNodeOrCompositeTreeNode) => IBasicInlineMenu[]);
  /**
   * 行内菜单点击的执行逻辑
   */
  inlineMenuActuator?: IBasicInlineMenuActuator;
}

export type IBasicNodeRendererProps = INodeRendererProps & IBasicNodeProps;

export interface IBasicTreeMenu {
  /**
   * 展示文本
   */
  label: string;
  /**
   * 唯一 ID
   */
  id: string;
  /**
   * 分组信息
   */
  group?: string;
  /**
   * 类型
   */
  type?: string;
}

export const DECORATIONS = {
  SELECTED: 'mod_selected',
  FOCUSED: 'mod_focused',
  ACTIVED: 'mod_actived',
  LOADING: 'mod_loading',
};
