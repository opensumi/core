import { IDisposable, IThemeColor, StatusBarHoverCommand } from '@opensumi/ide-core-common';

import { IMenu } from '../menu/next';

export const IStatusBarService = Symbol('IStatusBarService');

export interface IStatusBarService {
  getBackgroundColor(): string | undefined;
  setBackgroundColor(color?: string): void;
  setColor(color?: string): void;
  addElement(entryId: string, entry: StatusBarEntry): StatusBarEntryAccessor;
  setElement(entryId: string, fields: object): void;
  removeElement(entryId: string): void;
  /**
   * 设置状态栏元素显隐
   * @param entryId
   */
  toggleElement(entryId: string): void;
  contextMenu: IMenu;
  leftEntries: StatusBarEntry[];
  rightEntries: StatusBarEntry[];
}

export interface StatusBarHoverContent {
  title: string;
  name?: string;
  command?: StatusBarHoverCommand;
}

export interface StatusBarEntry {
  /**
   * 状态栏元素唯一 ID，如果由插件进程生成则为随机
   */
  entryId?: string;
  /**
   * 状态栏可读 id
   * 上层可指定，会设置在元素 id 上，若不存在则使用 entryId
   * 一个插件注册的状态栏元素 id 相同
   */
  id?: string;
  /**
   * 状态栏显示文案
   * 可以通过 text 设置图标
   * $(iconClassName) :text
   */
  text?: string;
  /**
   * 当前菜单显示名称
   * 标识当前状态栏组件 contextmenu 显示的名称，如果没有使用 text 代替
   */
  name?: string;
  alignment: StatusBarAlignment;
  color?: IThemeColor | string;
  backgroundColor?: IThemeColor | string;
  className?: string;
  tooltip?: string;
  command?: string;
  arguments?: any[];
  priority?: number;
  iconClass?: string;
  ariaLabel?: string;
  role?: string;
  /**
   * 是否默认展示，可以通过右键菜单控制
   */
  hidden?: boolean;
  /**
   * 鼠标移上去 Content 的内容
   */
  hoverContents?: StatusBarHoverContent[];
  onClick?: (e: any) => void;
}

export interface StatusBarEntryAccessor extends IDisposable {
  /**
   * Allows to update an existing status bar entry.
   */
  update(properties: StatusBarEntry): void;
}

export enum StatusBarAlignment {
  LEFT,
  RIGHT,
}

export namespace StatusBarCommand {
  export const changeColor = {
    id: 'statusbar.changeColor',
  };

  export const changeBackgroundColor = {
    id: 'statusbar.changeBackgroundColor',
  };

  export const addElement = {
    id: 'statusbar.addElement',
  };

  export const toggleElement = {
    id: 'statusbar.toggleElement',
  };
}

export interface StatusBarState {
  hidden: boolean;
}
