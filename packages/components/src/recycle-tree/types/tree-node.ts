export interface IAccessibilityInformation {
  label: string;
  role?: string;
}

export interface ITreeNode {
  /**
   * 唯一标识id
   */
  readonly id: number;
  /**
   * 节点深度
   */
  readonly depth: number;
  /**
   * 节点类型
   */
  readonly type: TreeNodeType;
  /**
   * 可用于自定义节点展示名称的字段，不需要保障唯一性，默认使用 name 作为展示值
   */
  readonly displayName: string;
  /**
   * 节点名称，需要保持该名称的唯一性，如果存在重复节点的情况，建议自定义 displayName 作为展示名称
   */
  readonly name: string;
  /**
   * 节点路径，这里的路径不一定指的是文件路径
   * 一般为${parent.name}/${this.name}拼接而成的绝对路径
   */
  readonly path: string;
  /**
   * 自定义节点icon
   */
  readonly icon?: string;
  /**
   * 描述节点是否可见，这里的可见表示的是否在展示数据内，并不是代表是否在用户视窗范围内
   */
  readonly visible?: boolean;
  /**
   * 父节点，但为undefined时，表示该节点为根节点
   */
  readonly parent: ICompositeTreeNode | undefined;
  /**
   * 节点无障碍信息
   */
  readonly accessibilityInformation?: IAccessibilityInformation;
  /**
   * 移动函数
   */
  mv: (to: ICompositeTreeNode | null, name?: string) => void;
  /**
   * 设置是否可见，这里的可见表示的是否在展示数据内，并不是代表是否在用户视窗范围内
   */
  setVisible: (b: boolean) => this;
}

export interface ICompositeTreeNode extends ITreeNode {
  expanded: boolean;
  /**
   * 子节点
   */
  children: ReadonlyArray<ITreeNodeOrCompositeTreeNode> | null;
}

export type ITreeNodeOrCompositeTreeNode = ITreeNode | ICompositeTreeNode;

export enum TreeNodeType {
  TreeNode = 1,
  CompositeTreeNode,
  NewPrompt,
  RenamePrompt,
}

export interface IOptionalMetaData {
  name?: string;
  [key: string]: any;
}
