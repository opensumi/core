import type React from 'react';

import { MaybeNull, BasicEvent } from '@opensumi/ide-core-common';

import type { IMenu, IContextMenu } from '../menu/next';
import type { SlotLocation } from '../react-providers';

export type Side = 'left' | 'right' | 'bottom';

export interface TabbarState {
  containerId: string;
  hidden: boolean;
}
export interface SideState {
  currentIndex: number;
  size: number;

  // 给底部panel，左右侧由currentIndex映射、尺寸使用size
  collapsed?: boolean;
  relativeSize?: number[];

  expanded?: boolean;
  tabbars: TabbarState[];
}

export interface SideStateManager {
  [side: string]: MaybeNull<SideState>;
}

export interface View {
  id: string;
  name?: string;
  weight?: number;
  priority?: number;
  collapsed?: boolean;
  hidden?: boolean;
  component?: React.ComponentType<any>;
  // 使用该参数时, view 的 toolbar 默认不渲染
  noToolbar?: boolean;
  initialProps?: any;
  titleMenu?: IMenu | IContextMenu;
  titleMenuContext?: any;
  when?: string;
}

export interface ViewContainerOptions extends ExtViewContainerOptions {
  containerId: string;
}
export interface ExtViewContainerOptions {
  iconClass?: string;
  priority?: number;
  containerId?: string;
  // 左右侧及底部面板必传
  title?: string;
  expanded?: boolean;
  size?: number;
  activateKeyBinding?: string;
  hidden?: boolean;
  badge?: string;
  // 直接使用自定义的React组件，会失去一些对面板的控制能力
  component?: React.ComponentType<any>;
  // 使用自定义组件时可以传入，否则请作为View的一部分传入
  initialProps?: object;
  // 自定义标题组件
  titleComponent?: React.ComponentType<any>;
  // 自定义titleComponent时可选传入
  titleProps?: object;
  // 若views为空，则不显示该container
  hideIfEmpty?: boolean;
  // 隐藏tab图标，仅挂载视图，视图切换交给其他逻辑控制
  hideTab?: boolean;
  noResize?: boolean;
  fromExtension?: boolean;
  // viewContainer 最小高度，默认 120
  miniSize?: number;
}
export const ComponentRegistry = Symbol('ComponentRegistry');

export interface ComponentRegistry {
  register(key: string, views: View | View[], options?: ExtViewContainerOptions, location?: SlotLocation): void;

  getComponentRegistryInfo(key: string): ComponentRegistryInfo | undefined;
}

export interface ComponentRegistryInfo {
  views: View[];
  options?: ViewContainerOptions;
}

export class ResizePayload {
  /**
   * Resize事件，会在用户拖动resize或窗口resize时触发
   * @param slotLocation 可能为slot或viewId
   */
  constructor(public slotLocation: SlotLocation) {}
}
export class ResizeEvent extends BasicEvent<ResizePayload> {}

export class RenderedEvent extends BasicEvent<void> {}
