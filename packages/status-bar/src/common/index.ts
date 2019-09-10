export interface StatusBarEntry {
  id?: string;
  /**
   * 可以通过 text 设置图标
   * $(iconClassName) :text
   */
  text?: string;
  alignment: StatusBarAlignment;
  color?: string;
  className?: string;
  tooltip?: string;
  command?: string;
  arguments?: any[];
  priority?: number;
  icon?: string;
  iconset?: 'fa' | 'octicon'; // 默认为 fa, 可使用 octicon 图标
  onClick?: (e: any) => void;
}

export enum StatusBarAlignment {
  LEFT, RIGHT,
}

export const IStatusBarService = Symbol('IStatusBarService');

export interface IStatusBarService {
  getBackgroundColor(): string | undefined;
  setBackgroundColor(color?: string): void;
  setColor(color?: string): void;
  getElementConfig(id: string, entry: StatusBarEntry): StatusBarEntry;
  addElement(id: string, entry: StatusBarEntry): void;
  setElement(id: string, fields: object): void;
  removeElement(id: string): void;
  leftEntries: StatusBarEntry[];
  rightEntries: StatusBarEntry[];
}
