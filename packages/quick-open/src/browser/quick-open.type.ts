import React from 'react';

import {
  HideReason,
  IKeyMods,
  QuickOpenActionProvider,
  QuickOpenItem,
  QuickOpenTabOptions,
} from '@opensumi/ide-core-browser';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';
import { IObservable } from '@opensumi/ide-monaco/lib/common/observable';

export const QuickOpenContext = React.createContext<{
  widget: IQuickOpenWidget;
}>({
  widget: null as any,
});

export interface IQuickOpenCallbacks {
  /**
   * 选择结果后执行的回调
   */
  onOk: () => void;
  /**
   * 取消选择后执行的回调
   */
  onCancel: () => void;
  /**
   * 用户在输入框搜索时执行的回调
   */
  onType: (lookFor: string) => void;
  /**
   * 失去焦点后是否需要保持 QuickOpen 继续存在
   */
  onFocusLost: () => boolean;
  /**
   * 关闭 QuickOpen 时发送的事件
   */
  onHide: (reason?: HideReason) => void;
  /**
   * select 状态时触发
   */
  onSelect: (item: QuickOpenItem, index: number) => void;
  /**
   * 多选确定后的回调
   */
  onConfirm: (items: QuickOpenItem[]) => void;
  /**
   * 获取用户是否按了 modifier 按键
   */
  onKeyMods: (mods: IKeyMods) => void;
}

export interface IQuickOpenModel {
  items: QuickOpenItem[];
  actionProvider?: QuickOpenActionProvider;
}

export interface IAutoFocus {
  /**
   * 要在结果列表中聚焦的元素的索引
   */
  autoFocusIndex?: number;
  /**
   * 如果设置为 true，将自动从结果列表中选择第一个条目
   */
  autoFocusFirstEntry?: boolean;
  /**
   * 如果设置为 true，将自动从结果列表中选择第二个条目
   */
  autoFocusSecondEntry?: boolean;
  /**
   * 如果设置为 true，将自动从结果列表中选择最后一个条目
   */
  autoFocusLastEntry?: boolean;
  /**
   * If set to true, will automatically select any entry whose label starts with the search
   * value. Since some entries to the top might match the query but not on the prefix, this
   * allows to select the most accurate match (matching the prefix) while still showing other
   * elements.
   */
  autoFocusPrefixMatch?: string;
}

export interface QuickOpenInputOptions extends QuickOpenTabOptions {
  placeholder?: string;
  password?: boolean;
  inputEnable?: boolean;
  valueSelection?: [number, number];
  canSelectMany?: boolean;
  keepScrollPosition?: boolean;
  busy?: boolean;
  enabled?: boolean;
}

export interface IQuickOpenWidget extends QuickOpenTabOptions {
  readonly inputValue: IObservable<string>;
  readonly selectIndex: IObservable<number>;
  readonly validateType: IObservable<VALIDATE_TYPE | undefined>;
  readonly keepScrollPosition: IObservable<boolean>;
  readonly busy: IObservable<boolean>;
  readonly isShow: IObservable<boolean>;
  readonly items: IObservable<QuickOpenItem[]>;
  readonly actionProvider: IObservable<QuickOpenActionProvider | null>;
  readonly autoFocus: IObservable<IAutoFocus | null>;
  readonly selectAll: IObservable<boolean>;
  readonly isPassword: IObservable<boolean>;
  readonly valueSelection: IObservable<[number, number] | undefined>;
  readonly canSelectMany: IObservable<boolean | undefined>;
  readonly inputPlaceholder: IObservable<string | undefined>;
  readonly inputEnable: IObservable<boolean | undefined>;

  readonly MAX_HEIGHT: number;
  readonly callbacks: IQuickOpenCallbacks;
  setInput(model: IQuickOpenModel, autoFocus: IAutoFocus, ariaLabel?: string): void;
  show(prefix: string, options: QuickOpenInputOptions): void;
  hide(reason?: HideReason): void;
  blur(): void;
  updateProgressStatus(visible: boolean): void;
  setSelectIndex(index: number): void;
  setInputValue(value: string): void;
}
