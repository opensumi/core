import { DropDownProps, IDataOption, IDataOptionGroup } from '@opensumi/ide-components';
import { IDisposable, BasicEvent, Event } from '@opensumi/ide-core-common';

export const IToolbarRegistry = Symbol('IToolbarRegistry');

export interface IToolbarRegistry {
  /**
   * 是否已经存在该位置
   * @param location
   */
  hasLocation(location: string);

  /**
   * 添加一个Toolbar位置
   * @param locationName
   */
  addLocation(locationName: string);

  /**
   * 设置默认的 location, 否则会使用第一个注册的位置
   */
  setDefaultLocation(locationName: string);

  /**
   * 注册一个 action group
   * @param group
   */
  registerToolbarActionGroup(group: IToolbarActionGroup): IDisposable;

  /**
   * 注册一个 action
   * @param action
   */
  registerToolbarAction(action: IToolbarAction): IDisposable;

  getToolbarActions(position: IToolbarActionPosition): IToolbarActionGroupForRender | undefined;

  getActionGroups(location: string): IToolbarActionGroup[] | undefined;

  getActionPosition(actionId: string): IToolbarActionPosition | undefined;

  getAllLocations(): string[];

  isReady(): boolean;
}

export interface IToolbarActionGroupForRender {
  group: IToolbarActionGroup;
  position: IToolbarActionPosition;
  actions: IToolbarAction[];
}

export interface IToolbarActionGroup {
  /**
   * id 请保证全局唯一
   */
  id: string;

  /**
   * 顺序重量, 数值越大，排在越前面, 默认为0
   */
  weight?: number;

  /**
   * 喜好的 location, 默认 default
   */
  preferredLocation?: string;

  /**
   * 元素紧贴在一起
   */
  compact?: boolean;
}

export interface ISize {
  width: number;
  height: number;
}

export interface IToolbarActionPosition {
  location: string;
  group: string;
}

export interface IToolbarLocationPreference {
  // 位置不够时也不添加 more 按钮
  noDropDown?: boolean;

  // action 间的间距, 默认为 5
  actionMargin?: number;

  // more 按钮的宽度 默认为 14
  moreActionWidth?: number;

  // 默认的button样式
  defaultButtonStyle?: IToolbarActionBtnStyle;
}

export interface IToolbarLocationProps {
  location: string;

  preferences?: IToolbarLocationPreference;
}

export interface IToolbarActionElementProps {
  inDropDown: boolean;

  action: IToolbarAction;

  closeDropDown: () => void;

  preferences?: IToolbarLocationPreference;

  location: string;
}

export type IToolbarActionReactElement = React.ComponentType<IToolbarActionElementProps>;

export interface IToolbarAction {
  id: string;

  /**
   * 这个action的介绍，为了让用户能明白这个组件是做什么，理论上必填
   */
  description: string;
  /**
   * 顺序重量, 数值越大，排在越前面
   */
  weight?: number;

  /**
   * 这个元素预估占据的位置, 会根据这个进行收起的计算
   * 如果不传的话，会使用默认的 width = 100, height = 30;
   */
  suggestSize?: ISize;

  /**
   * 会被渲染的组件
   */
  component: IToolbarActionReactElement;

  /**
   * 注册这个 action 喜好的位置， 如果 strictPosition 存在，这个选项无效
   *
   * 规则：
   * 注： 每个 location 默认存在 _head  _tail 两个group，代表了第一个和最后一个group
   * 1. 如果提供 group 值, 且 group 不为 _head 和 _tail
   *    1. 如果 group 已注册, 将其注册在group内，跟随 group 出现
   *    3. 如果 group 未注册
   *        1. 如果 location 存在， 它会出现在指定 location 的 _tail
   *        2. 如果 location 不存在， 它会出现在默认 location 的 _tail
   * 2. 如果提供 group 值, 且 group 为 _head 或 _tail
   *    1. 如果 location 已注册, 它会出现在指定 location 的 group 位置。
   *    2. 如果 location 未注册 它会出现在默认 location 的 group 位置。
   * 3. 如果仅仅提供 location 值
   *    1. 如果 location 已注册, 它会出现在指定 location 的 _tail 位置。
   *    2. 如果 location 未注册 它会出现在默认 location 的 _tail 位置。
   * 4. 如果什么 position 建议都没有，出现在 默认location 的 _tail
   *
   * 真实的位置不会反复计算，仅仅在Toolbar首次渲染时（onStart）计算，或者渲染后 action 注册时计算。
   * 但是 order 会反复计算。
   */
  preferredPosition?: Partial<IToolbarActionPosition>;

  /**
   * 如果存在这个值，会永远寻找指定的位置。
   */
  strictPosition?: IToolbarActionPosition;

  /**
   * 是否永远不被收起
   */
  neverCollapse?: boolean;
  when?: string;
}

// events
export class ToolbarRegistryReadyEvent extends BasicEvent<void> {}

export class ToolbarActionsWhenChangeEvent extends BasicEvent<void> {}

export class ToolbarActionsChangedEvent extends BasicEvent<{ position: IToolbarActionPosition }> {}

export class ToolbarActionGroupsChangedEvent extends BasicEvent<{ location: string }> {}

export const ToolBarActionContribution = Symbol('ToolBarActionContribution');
export interface ToolBarActionContribution {
  registerToolbarActions(registry: IToolbarRegistry);
}

export interface IToolbarActionBtnState extends IToolbarActionBtnStyle {
  title?: string;
  iconClass?: string;
}

export interface IToolbarActionBtnProps {
  id: string;
  title: string;
  iconClass: string;
  defaultStyle?: IToolbarActionBtnStyle;
  styles?: {
    [key: string]: IToolbarActionBtnState;
  };
  defaultState?: string;
  delegate?: (delegate: IToolbarActionBtnDelegate | undefined) => void;
  /**
   * 在下方的 popover 的元素
   * 它会位于目标元素
   */
  popoverComponent?: React.FC;
  popoverId?: string;

  popoverStyle?: IToolbarPopoverStyle;
}

export interface IToolbarActionBtnDelegate {
  onClick: Event<React.MouseEvent<HTMLDivElement>>;

  onMouseEnter: Event<React.MouseEvent<HTMLDivElement>>;

  onMouseLeave: Event<React.MouseEvent<HTMLDivElement>>;

  onChangeContext: Event<any>;

  onDidChangePopoverVisibility: Event<boolean>;

  setState(state: string, title?: string): void;
  getState(): string;

  setContext(context: any): void;

  // 获取当期组件的位置 rect
  getRect(): ClientRect;

  // 获得 popover 的子容器
  getPopOverContainer(): HTMLDivElement | undefined;

  // 渲染并展示 popover 元素
  showPopOver(style?: IToolbarPopoverStyle): Promise<void>;

  /**
   * 隐藏 popOver 元素
   */
  hidePopOver(): Promise<void>;

  onChangeState: Event<{ from: string; to: string }>;
}

export interface IToolbarActionBtnStyle {
  // 指定按钮宽度
  // 不指定，则按默认8px左右边距
  width?: number;

  // 指定按钮高度
  // 默认值为 22
  height?: number;

  // 是否显示 Title
  // 默认为 false
  showTitle?: boolean;

  // icon 前景色
  iconForeground?: string;

  // icon 背景色
  iconBackground?: string;

  // title 前景色
  titleForeground?: string;

  // title 背景色
  titleBackground?: string;

  // title 字体大小
  titleSize?: string;

  // icon 大小
  iconSize?: string;

  // 整体背景色
  background?: string;

  // 样式类型，
  // inline 不会有外边框
  // button 为按钮样式
  // inline 模式 showTitle 会失效, 只显示icon
  btnStyle?: 'inline' | 'button';

  // button 的文本位置样式
  // vertical: 上icon 下文本
  // horizontal: 左icon 右文本
  btnTitleStyle?: 'vertical' | 'horizontal';
}

// Select
export interface IToolbarActionSelectProps<T> {
  options: IDataOption<T>[] | IDataOptionGroup<T>[];
  customOptionRenderer?: React.FC<{ data: IDataOption<T>; isCurrent: boolean }>;
  defaultValue?: T;
  styles?: {
    [key: string]: IToolbarSelectStyle;
  };
  name?: string;
  searchMode?: boolean;
  defaultState?: string;
  equals?: (v1: T | undefined, v2: T | undefined) => boolean;
  onSelect?: (value: T) => void;
  delegate?: (delegate: IToolbarActionSelectDelegate<T> | undefined) => void;
}

export interface IToolbarActionDropdownButtonDelegate<T> {
  onSelect: Event<T>;
}

// DropdownButton
export interface IToolbarActionDropdownButtonProps<T> {
  options: IDataOption<T>[];
  trigger?: DropDownProps['trigger'];
  onSelect?: (value: T) => void;
  delegate?: (delegate: IToolbarActionDropdownButtonDelegate<T> | undefined) => void;
}

export interface IToolbarActionSelectDelegate<T> {
  setState(state: string): void;
  setSelect(value: T): void;
  setOptions(
    options: {
      iconClass?: string;
      label?: string;
      value: T;
    }[],
  ): void;
  onChangeState: Event<{ from: string; to: string }>;
  onSelect: Event<T>;
  getValue(): T | undefined;
}

export interface IToolbarSelectStyle {
  backgroundColor?: string;
  labelForegroundColor?: string;
  iconForegroundColor?: string;
  width?: number;
  minWidth?: number;
}

export interface IToolbarPopoverStyle {
  /**
   * 在上方还是在下方, 默认下方
   * 暂时只支持 bottom;
   */
  position?: 'top' | 'bottom';

  /**
   * ```text
   * 距离右边的偏移量(px), 默认 30
   *     [ button ]
   *          /\  |<-offset->|
   *  [------   -------------]
   *  [                      ]
   *  [      popover         ]
   *  [                      ]
   *  [______________________]
   * ```
   */
  horizontalOffset?: number;

  /**
   * 点击组件外部时自动隐藏, 默认 true
   */
  hideOnClickOutside?: boolean;

  /**
   * 不要带箭头，阴影，背景色等默认样式
   */
  noContainerStyle?: boolean;

  /**
   * 指定 popOver 的最小宽度
   */
  minWidth?: number;

  /**
   * 指定 popOver 的最小高度
   */
  minHeight?: number;
}

export const IToolbarPopoverRegistry = Symbol('IToolbarPopoverRegistry');

export interface IToolbarPopoverRegistry {
  registerComponent(id: string, component: React.FC): IDisposable;
  getComponent(id: string): React.FC | undefined;

  onDidRegisterPopoverEvent: Event<string>;
}
